import Foundation
import StoreKit
import Combine

@MainActor
final class PurchaseManager: ObservableObject {
    @Published private(set) var product: Product?
    @Published private(set) var isPremium = false
    @Published var isWorking = false
    @Published var errorMessage: String?
    private var updates: Task<Void, Never>?

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
            await refreshEntitlements()
        } catch {
            product = nil
            errorMessage = "商品情報を取得できませんでした"
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
                isPremium = true
            case .userCancelled, .pending: break
            @unknown default: break
            }
        } catch { errorMessage = error.localizedDescription }
    }

    func restore(auth: AuthStore) async {
        isWorking = true; defer { isWorking = false }
        do {
            try await AppStore.sync()
            for await result in Transaction.currentEntitlements {
                guard let transaction = try? verified(result), transaction.productID == AppConfig.subscriptionProductID else { continue }
                try await APIClient.shared.verifyApplePurchase(signedTransaction: result.jwsRepresentation, auth: auth)
            }
            await refreshEntitlements()
        } catch { errorMessage = "購入内容を復元できませんでした" }
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            guard let transaction = try? verified(result) else { continue }
            await transaction.finish()
            await refreshEntitlements()
        }
    }

    private func refreshEntitlements() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if let transaction = try? verified(result), transaction.productID == AppConfig.subscriptionProductID,
               transaction.revocationDate == nil, transaction.expirationDate.map({ $0 > Date() }) ?? true { active = true }
        }
        isPremium = active
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result { case .verified(let value): value; case .unverified: throw APIError.server("購入情報を確認できませんでした") }
    }
}
