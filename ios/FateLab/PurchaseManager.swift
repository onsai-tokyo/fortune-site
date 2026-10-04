import Foundation
import StoreKit
import Combine

@MainActor
final class PurchaseManager: ObservableObject {
    enum AccessState { case unknown, premium, standard }
    @Published private(set) var product: Product?
    @Published private(set) var bookProduct: Product?
    @Published private(set) var accessState: AccessState = .unknown
    @Published var isWorking = false
    @Published private(set) var isSyncing = false
    @Published var errorMessage: String?
    @Published private(set) var hasStoreKitEntitlement = false
    private var isFirstSyncForThisAccount = true
    private weak var authStore: AuthStore?
    private var consecutiveSyncFailures = 0
    private let delivery = PurchaseDelivery()
    private var accountRevision: UInt64 = 0
    private var boundScope: AccountScope?
    private var syncID: UUID?
    private var syncTask: Task<Void, Never>?
    private var updates: Task<Void, Never>?
    private let api: APIClient
    private let storeKitEnabled: Bool
    var isPremium: Bool { accessState == .premium }

    /// Do not carry purchase UI state from one FATE LAB account to another.
    func resetForAccountChange() {
        accountRevision &+= 1
        syncTask?.cancel(); syncTask = nil
        boundScope = nil; syncID = nil
        authStore = nil
        accessState = .unknown
        hasStoreKitEntitlement = false
        isFirstSyncForThisAccount = true
        consecutiveSyncFailures = 0
        errorMessage = nil
        isWorking = false
        isSyncing = false
    }

    private func bind(_ auth: AuthStore) -> AccountScope {
        let scope = AccountScope(auth)
        if boundScope != scope { resetForAccountChange(); boundScope = scope }
        authStore = auth
        return scope
    }

    private func check(_ scope: AccountScope, _ auth: AuthStore) throws {
        try scope.check(auth)
        guard boundScope == scope else { throw CancellationError() }
    }

    init(api: APIClient = .shared, storeKitEnabled: Bool = AppConfig.storeKitEnabled) {
        self.api = api
        self.storeKitEnabled = storeKitEnabled && AppConfig.storeKitEnabled
        guard self.storeKitEnabled else { return }
        updates = Task { await listenForTransactions() }
        Task { await load() }
    }

    deinit { updates?.cancel() }

    func load() async {
        guard self.storeKitEnabled else { return }
        let revision = accountRevision
        errorMessage = nil
        do {
            let products = try await Product.products(for: [AppConfig.subscriptionProductID, AppConfig.bookProductID])
            let loaded = products.first { $0.id == AppConfig.subscriptionProductID }
            guard accountRevision == revision else { return }
            product = loaded
            bookProduct = products.first { $0.id == AppConfig.bookProductID }
            if product == nil { errorMessage = "商品情報を取得できませんでした" }
        } catch {
            guard accountRevision == revision else { return }
            product = nil
            if userFacingErrorMessage(error) != nil { errorMessage = "商品情報を取得できませんでした" }
        }
    }

    private func deliver(_ transaction: Transaction, signed: String, auth: AuthStore, owner: AccountScope, allowTransfer: Bool = false) async throws -> Bool {
        try check(owner, auth)
        guard let userID = owner.userID else { throw CancellationError() }
        let existing = try delivery.pending().first { $0.transactionID == String(transaction.id) && $0.ownerID == userID }
        let value = existing ?? PendingPurchase(transactionID: String(transaction.id), ownerID: userID,
            signedTransaction: signed, allowOwnerTransfer: allowTransfer, operationID: UUID())
        return try await delivery.deliver(value, isCurrent: { owner.isCurrent(auth) && self.boundScope == owner },
            mirror: { try await api.verifyApplePurchase(signedTransaction: value.signedTransaction,
                allowOwnerTransfer: value.allowOwnerTransfer, operationID: value.operationID, auth: auth) }, finish: { await transaction.finish() })
    }

    func purchase(userID: UUID, auth: AuthStore) async {
        guard self.storeKitEnabled else { errorMessage = AppConfig.purchasesUnavailableMessage; return }
        let owner = bind(auth)
        guard owner.userID == userID, !isWorking else { return }
        guard !isSyncing else { errorMessage = "購入履歴を確認しています。確認が終わってからお試しください。"; return }
        guard !hasStoreKitEntitlement else { errorMessage = "Appleの会員資格を確認しました。「購入を復元」で利用枠を反映してください。"; return }
        guard accessState == .standard else { errorMessage = "購入状況を確認してからお試しください。"; return }
        guard let product else { errorMessage = "料金情報を準備中です"; return }
        isWorking = true; errorMessage = nil
        defer { if owner.isCurrent(auth), boundScope == owner { isWorking = false } }
        do {
            guard try delivery.pending().allSatisfy({ $0.ownerID != userID }) else {
                throw APIError.server("反映待ちの購入があります。再購入せず、購入状況の確認を再試行してください。")
            }
            let result = try await product.purchase(options: [.appAccountToken(userID)])
            try check(owner, auth)
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                _ = try await deliver(transaction, signed: verification.jwsRepresentation, auth: auth, owner: owner, allowTransfer: true)
                try check(owner, auth)
                await syncAfterDelivery(auth: auth)
            case .userCancelled: break
            case .pending: errorMessage = "購入の承認を待っています。再購入せず、承認後に購入状況を確認してください。"
            @unknown default: accessState = .unknown
            }
        } catch {
            if owner.isCurrent(auth), boundScope == owner {
                accessState = .unknown
                errorMessage = userFacingErrorMessage(error)
            }
        }
    }

    /// Re-send the verified current period when books are first enabled for an existing member.
    func syncBookMembership(auth: AuthStore) async throws {
        guard storeKitEnabled else { return }
        let owner = bind(auth)
        if let syncTask { await syncTask.value }
        try check(owner, auth)
        for await result in Transaction.currentEntitlements {
            try check(owner, auth)
            guard let transaction = try? verified(result), isActiveSubscription(transaction), transaction.appAccountToken == owner.userID else { continue }
            _ = try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner)
        }
    }

    func purchaseBook(auth: AuthStore) async throws {
        guard storeKitEnabled else { throw APIError.server(AppConfig.purchasesUnavailableMessage) }
        let owner = bind(auth)
        guard let userID = owner.userID, !isWorking, !isSyncing else { throw APIError.server("購入状況の確認が終わってからお試しください。") }
        guard let bookProduct else { throw APIError.server("鑑定書の商品情報を取得できませんでした。") }
        guard try delivery.pending().allSatisfy({ $0.ownerID != userID }) else { throw APIError.server("反映待ちの購入があります。再購入せず購入状況を確認してください。") }
        isWorking = true
        defer { if owner.isCurrent(auth), boundScope == owner { isWorking = false } }
        let result = try await bookProduct.purchase(options: [.appAccountToken(userID)])
        try check(owner, auth)
        switch result {
        case .success(let verification):
            let transaction = try verified(verification)
            _ = try await deliver(transaction, signed: verification.jwsRepresentation, auth: auth, owner: owner)
            try check(owner, auth)
        case .userCancelled: throw CancellationError()
        case .pending: throw APIError.server("購入の承認を待っています。承認後に本棚で利用枠をご確認ください。")
        @unknown default: throw APIError.invalidResponse
        }
    }

    func restore(auth: AuthStore) async {
        guard self.storeKitEnabled else { errorMessage = AppConfig.purchasesUnavailableMessage; return }
        let owner = bind(auth)
        guard owner.userID != nil, !isWorking else { return }
        isWorking = true; errorMessage = nil
        defer { if owner.isCurrent(auth), boundScope == owner { isWorking = false } }
        do {
            try await AppStore.sync()
            try check(owner, auth)
            var restored = 0
            for await result in Transaction.currentEntitlements {
                try check(owner, auth)
                guard let transaction = try? verified(result), transaction.productID == AppConfig.subscriptionProductID else { continue }
                if try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner, allowTransfer: true) { restored += 1 }
            }
            await syncAfterDelivery(auth: auth)
            try check(owner, auth)
            if restored == 0 && accessState == .standard {
                errorMessage = "このApple Accountに有効な継続鑑定が見つかりませんでした。購入時と同じApple Accountをご確認ください。"
            }
        } catch {
            guard owner.isCurrent(auth), boundScope == owner else { return }
            accessState = .unknown
            errorMessage = "購入の反映を確認できませんでした。再購入せず、購入状況の確認を再試行してください。"
        }
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            guard let transaction = try? verified(result), [AppConfig.subscriptionProductID, AppConfig.bookProductID].contains(transaction.productID),
                  let auth = authStore, let userID = auth.userID else { continue }
            // Updates are never an implicit owner-transfer operation.
            guard transaction.appAccountToken == userID else { continue }
            let owner = bind(auth)
            do {
                _ = try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner)
                try check(owner, auth)
                await syncAfterDelivery(auth: auth)
            } catch {
                if owner.isCurrent(auth), boundScope == owner {
                    accessState = .unknown
                    errorMessage = "購入を反映できませんでした。購入状況の確認を再試行してください。"
                }
            }
        }
    }

    private func retryDeliveries(auth: AuthStore, owner: AccountScope) async throws -> Bool {
        var mirrored = false
        // StoreKit retains unfinished transactions even if the app stopped before
        // the Keychain enqueue. Finished-but-not-cleared entries are found in all.
        for await result in Transaction.unfinished {
            try check(owner, auth)
            guard let transaction = try? verified(result), [AppConfig.subscriptionProductID, AppConfig.bookProductID].contains(transaction.productID),
                  transaction.appAccountToken == owner.userID else { continue }
            if try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner) { mirrored = true }
        }
        let pending = try delivery.pending().filter { $0.ownerID == owner.userID }
        if !pending.isEmpty {
            for await result in Transaction.all {
                try check(owner, auth)
                guard let transaction = try? verified(result), [AppConfig.subscriptionProductID, AppConfig.bookProductID].contains(transaction.productID),
                      pending.contains(where: { $0.transactionID == String(transaction.id) }) else { continue }
                if try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner) { mirrored = true }
            }
        }
        try check(owner, auth)
        guard try delivery.pending().allSatisfy({ $0.ownerID != owner.userID }) else {
            throw APIError.server("反映待ちの購入があります。購入状況の確認を再試行してください。")
        }
        return mirrored
    }

    private func syncAfterDelivery(auth: AuthStore) async {
        let owner = bind(auth)
        // A lookup already in flight may predate the delivery acknowledgement.
        // Share that work, then request a fresh authoritative server result.
        if let syncTask { await syncTask.value }
        guard owner.isCurrent(auth), boundScope == owner else { return }
        await sync(auth: auth)
    }

    /// StoreKit is only a signal that the server mirror may need updating.
    /// The server status remains the single source of truth used by the UI.
    func sync(auth: AuthStore) async {
        guard !AppConfig.authenticationCheckOnly else { return }
        let owner = bind(auth)
        guard owner.userID != nil else { return }
        // Root and Settings can appear together. They must not invalidate one
        // another's result or enumerate the same StoreKit history repeatedly.
        if let syncTask { await syncTask.value; return }
        let operation = UUID(); syncID = operation
        isSyncing = true
        let task = Task { await performSync(auth: auth, owner: owner, operation: operation) }
        syncTask = task
        await task.value
    }

    private func performSync(auth: AuthStore, owner: AccountScope, operation: UUID) async {
        defer {
            if syncID == operation { isSyncing = false; syncID = nil; syncTask = nil }
        }
        errorMessage = nil
        do {
            try check(owner, auth)
            var status = try await api.status(auth: auth)
            try check(owner, auth)
            guard syncID == operation else { return }
            // Show the server's current membership before waiting for Apple.
            // New purchases stay disabled until pending deliveries are checked.
            accessState = status.isPremium ? .premium : .standard
            var mirrored = false
            if storeKitEnabled {
                await refreshLocalEntitlements()
                try check(owner, auth)
                mirrored = try await retryDeliveries(auth: auth, owner: owner)
            }
            try check(owner, auth)
            guard syncID == operation else { return }
            if mirrored {
                status = try await api.status(auth: auth)
                try check(owner, auth)
                guard syncID == operation else { return }
                accessState = status.isPremium ? .premium : .standard
                mirrored = false
            }
            // AppStore.sync can display an Apple Account password prompt.
            // Only the explicit Restore Purchases action may request it.

            if storeKitEnabled && hasStoreKitEntitlement && !status.isPremium {
                for await result in Transaction.currentEntitlements {
                    try check(owner, auth)
                    guard let transaction = try? verified(result), isActiveSubscription(transaction) else { continue }
                    guard transaction.appAccountToken == owner.userID else { continue }
                    if try await deliver(transaction, signed: result.jwsRepresentation, auth: auth, owner: owner) { mirrored = true }
                }
                try check(owner, auth)
            }
            if mirrored {
                status = try await api.status(auth: auth)
            }
            try check(owner, auth)
            guard syncID == operation else { return }
            accessState = status.isPremium ? .premium : .standard
            consecutiveSyncFailures = 0
            errorMessage = hasStoreKitEntitlement && accessState == .standard
                ? "このApple Accountには継続鑑定の購入履歴があります。引き継ぐ場合は「購入を復元」を押してください。"
                : nil
        } catch {
            guard owner.isCurrent(auth), boundScope == owner, syncID == operation else { return }
            accessState = .unknown
            consecutiveSyncFailures += 1
            if userFacingErrorMessage(error) != nil {
                errorMessage = "購入内容を確認できませんでした。再購入せず、購入状況の確認を再試行してください。"
            }
        }
        guard owner.isCurrent(auth), boundScope == owner, syncID == operation else { return }
        isFirstSyncForThisAccount = false
    }

    private func refreshLocalEntitlements() async {
        let revision = accountRevision
        var active = false
        for await result in Transaction.currentEntitlements {
            if let transaction = try? verified(result), isActiveSubscription(transaction) { active = true }
        }
        guard accountRevision == revision else { return }
        hasStoreKitEntitlement = active
    }

    private func isActiveSubscription(_ transaction: Transaction) -> Bool {
        transaction.productID == AppConfig.subscriptionProductID
            && transaction.revocationDate == nil
            && (transaction.expirationDate.map { $0 > Date() } ?? true)
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result { case .verified(let value): value; case .unverified: throw APIError.server("購入情報を確認できませんでした") }
    }
}
