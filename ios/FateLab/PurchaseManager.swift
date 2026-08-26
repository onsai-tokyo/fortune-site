import Foundation
import StoreKit
import Combine

@MainActor
final class PurchaseManager: ObservableObject {
    enum AccessState { case unknown, premium, standard }
    @Published private(set) var product: Product?
    @Published private(set) var accessState: AccessState = .unknown
    @Published var isWorking = false
    @Published var errorMessage: String?
    private var hasStoreKitEntitlement = false
    private var attemptedStoreSyncThisSession = false
    private var isFirstSyncForThisAccount = true
    private weak var authStore: AuthStore?
    private var consecutiveSyncFailures = 0
    private var updates: Task<Void, Never>?
    var isPremium: Bool { accessState == .premium }

    /// Do not carry purchase UI state from one FATE LAB account to another.
    func resetForAccountChange() {
        authStore = nil
        accessState = .unknown
        hasStoreKitEntitlement = false
        attemptedStoreSyncThisSession = false
        isFirstSyncForThisAccount = true
        consecutiveSyncFailures = 0
        errorMessage = nil
        isWorking = false
    }

    init() {
        updates = Task { await listenForTransactions() }
        Task { await load() }
    }

    deinit { updates?.cancel() }

    func load() async {
        errorMessage = nil
        do {
            product = try await Product.products(for: [AppConfig.subscriptionProductID]).first
            if product == nil { errorMessage = "商品情報を取得できませんでした" }
            await refreshLocalEntitlements()
        } catch {
            product = nil
            if userFacingErrorMessage(error) != nil { errorMessage = "商品情報を取得できませんでした" }
        }
    }

    func purchase(userID: UUID, auth: AuthStore) async {
        authStore = auth
        guard let product else { errorMessage = "料金情報を準備中です"; return }
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            let result = try await product.purchase(options: [.appAccountToken(userID)])
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                _ = try await APIClient.shared.verifyApplePurchase(signedTransaction: verification.jwsRepresentation, allowOwnerTransfer: true, auth: auth)
                await transaction.finish()
                await sync(auth: auth)
            case .userCancelled, .pending: break
            @unknown default: break
            }
        } catch { errorMessage = userFacingErrorMessage(error) }
    }

    func restore(auth: AuthStore) async {
        authStore = auth
        isWorking = true; errorMessage = nil; defer { isWorking = false }
        do {
            try await AppStore.sync()
            var restored = 0
            for await result in Transaction.currentEntitlements {
                guard let transaction = try? verified(result), transaction.productID == AppConfig.subscriptionProductID else { continue }
                if try await APIClient.shared.verifyApplePurchase(signedTransaction: result.jwsRepresentation, allowOwnerTransfer: true, auth: auth) {
                    restored += 1
                }
            }
            await sync(auth: auth)
            if restored == 0 {
                errorMessage = "このApple Accountに有効な継続鑑定が見つかりませんでした。購入時と同じApple Accountをご確認ください。"
            } else if accessState != .premium {
                errorMessage = "購入情報は見つかりましたが、反映を完了できませんでした。もう一度お試しください。"
            }
        } catch {
            errorMessage = "購入内容を復元できませんでした。Apple Accountと通信環境をご確認ください。"
        }
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            guard let transaction = try? verified(result) else { continue }
            if transaction.productID == AppConfig.subscriptionProductID, let authStore {
                _ = try? await APIClient.shared.verifyApplePurchase(signedTransaction: result.jwsRepresentation, auth: authStore)
            }
            await transaction.finish()
            await refreshLocalEntitlements()
        }
    }

    /// StoreKit is only a signal that the server mirror may need updating.
    /// The server status remains the single source of truth used by the UI.
    func sync(auth: AuthStore) async {
        authStore = auth
        errorMessage = nil
        accessState = .unknown
        await refreshLocalEntitlements()
        do {
            var status = try await APIClient.shared.status(auth: auth)
            if !status.isPremium && !hasStoreKitEntitlement && !attemptedStoreSyncThisSession {
                attemptedStoreSyncThisSession = true
                try await AppStore.sync()
                await refreshLocalEntitlements()
            }
            if hasStoreKitEntitlement && !status.isPremium && !isFirstSyncForThisAccount {
                for await result in Transaction.currentEntitlements {
                    guard let transaction = try? verified(result), isActiveSubscription(transaction) else { continue }
                    _ = try await APIClient.shared.verifyApplePurchase(
                        signedTransaction: result.jwsRepresentation,
                        auth: auth
                    )
                }
                status = try await APIClient.shared.status(auth: auth)
            }
            accessState = status.isPremium ? .premium : .standard
            consecutiveSyncFailures = 0
            errorMessage = hasStoreKitEntitlement && accessState == .standard
                ? "このApple Accountには継続鑑定の購入履歴があります。引き継ぐ場合は「購入を復元」を押してください。"
                : nil
        } catch {
            accessState = .unknown
            consecutiveSyncFailures += 1
            if consecutiveSyncFailures >= 3, userFacingErrorMessage(error) != nil {
                errorMessage = "購入内容を確認できませんでした。購入を復元してください。"
            }
        }
        isFirstSyncForThisAccount = false
    }

    private func refreshLocalEntitlements() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if let transaction = try? verified(result), isActiveSubscription(transaction) { active = true }
        }
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
