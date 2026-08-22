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
    private var consecutiveSyncFailures = 0
    private var updates: Task<Void, Never>?
    var isPremium: Bool { accessState == .premium }

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
        guard let product else { errorMessage = "料金情報を準備中です"; return }
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            let result = try await product.purchase(options: [.appAccountToken(userID)])
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                try await APIClient.shared.verifyApplePurchase(signedTransaction: verification.jwsRepresentation, auth: auth)
                await transaction.finish()
                await sync(auth: auth)
            case .userCancelled, .pending: break
            @unknown default: break
            }
        } catch { errorMessage = userFacingErrorMessage(error) }
    }

    func restore(auth: AuthStore) async {
        isWorking = true; errorMessage = nil; defer { isWorking = false }
        do {
            try await AppStore.sync()
            for await result in Transaction.currentEntitlements {
                guard let transaction = try? verified(result), transaction.productID == AppConfig.subscriptionProductID else { continue }
                try await APIClient.shared.verifyApplePurchase(signedTransaction: result.jwsRepresentation, auth: auth)
            }
            await sync(auth: auth)
        } catch {
            if userFacingErrorMessage(error) != nil { errorMessage = "購入内容を復元できませんでした" }
        }
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            guard let transaction = try? verified(result) else { continue }
            await transaction.finish()
            await refreshLocalEntitlements()
        }
    }

    /// StoreKit is only a signal that the server mirror may need updating.
    /// The server status remains the single source of truth used by the UI.
    func sync(auth: AuthStore) async {
        errorMessage = nil
        accessState = .unknown
        await refreshLocalEntitlements()
        do {
            var status = try await APIClient.shared.status(auth: auth)
            if hasStoreKitEntitlement && !status.isPremium {
                for await result in Transaction.currentEntitlements {
                    guard let transaction = try? verified(result), isActiveSubscription(transaction) else { continue }
                    try await APIClient.shared.verifyApplePurchase(
                        signedTransaction: result.jwsRepresentation,
                        auth: auth
                    )
                }
                status = try await APIClient.shared.status(auth: auth)
            }
            accessState = status.isPremium ? .premium : .standard
            consecutiveSyncFailures = 0
            errorMessage = nil
        } catch {
            accessState = .unknown
            consecutiveSyncFailures += 1
            if consecutiveSyncFailures >= 3, userFacingErrorMessage(error) != nil {
                errorMessage = "購入内容を確認できませんでした。購入を復元してください。"
            }
        }
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
