import Foundation

/// StoreKit can return an old unfinished renewal instead of opening checkout.
/// Continue only after that historical transaction was verified, delivered and
/// finished. Never retry an uncertain, pending, cancelled or current purchase.
enum MembershipPurchaseFlow {
    enum Attempt: Equatable { case delivered, historical(String), cancelled, pending }

    static func isHistorical(expiration: Date?, revoked: Bool, upgraded: Bool, startedAt: Date) -> Bool {
        !revoked && !upgraded && expiration.map { $0 <= startedAt } == true
    }

    @MainActor static func run(attempt: () async throws -> Attempt) async throws -> Attempt {
        var finished = Set<String>()
        for _ in 0..<32 {
            try Task.checkCancellation()
            let result = try await attempt()
            guard case .historical(let id) = result else { return result }
            guard finished.insert(id).inserted else {
                throw APIError.server("Appleから同じ過去の購入情報が届いています。時間をおいて購入状況を再確認してください。")
            }
        }
        throw APIError.server("過去の購入履歴を整理しました。購入状況を確認してから、もう一度お試しください。")
    }
}

struct ApplePurchaseVerification: Decodable {
    let verified: Bool
    let delivery: String
    let transactionID: String
    let ownerID: UUID?
    enum CodingKeys: String, CodingKey { case verified, delivery; case transactionID = "transactionId", ownerID = "ownerId" }
    func accepts(transactionID: String, ownerID: UUID) -> Bool {
        verified && delivery == "mirrored" && self.transactionID == transactionID && self.ownerID == ownerID
    }
}

struct PendingPurchase: Codable, Equatable {
    let transactionID: String
    let ownerID: UUID
    let signedTransaction: String
    let allowOwnerTransfer: Bool
    var operationID: UUID? = nil
}

/// Durable before dispatch; finish only after a typed server acknowledgement.
@MainActor final class PurchaseDelivery {
    private let read: () throws -> Data?
    private let write: (Data) throws -> Void
    private var inFlight = Set<String>()
    init(read: @escaping () throws -> Data? = { try KeychainStore.readChecked(account: "purchase.pending.v1") },
         write: @escaping (Data) throws -> Void = { try KeychainStore.save($0, account: "purchase.pending.v1") }) {
        self.read = read; self.write = write
    }
    func pending() throws -> [PendingPurchase] {
        guard let data = try read() else { return [] }
        return try JSONDecoder().decode([PendingPurchase].self, from: data)
    }
    private func key(_ value: PendingPurchase) -> String { value.ownerID.uuidString + ":" + value.transactionID }
    func enqueue(_ value: PendingPurchase) throws {
        var values = try pending()
        if let old = values.first(where: { key($0) == key(value) }) {
            guard old == value else { throw APIError.invalidResponse }
            return
        }
        values.append(value)
        try write(JSONEncoder().encode(values))
    }
    func deliver(_ value: PendingPurchase, isCurrent: () -> Bool,
                 mirror: () async throws -> ApplePurchaseVerification,
                 finish: () async -> Void) async throws -> Bool {
        let id = key(value)
        guard !inFlight.contains(id) else { return false }
        inFlight.insert(id); defer { inFlight.remove(id) }
        try enqueue(value)
        guard isCurrent() else { throw CancellationError() }
        let response = try await mirror()
        guard isCurrent() else { throw CancellationError() }
        guard response.accepts(transactionID: value.transactionID, ownerID: value.ownerID) else {
            throw APIError.server("購入の反映を確認できませんでした。再購入せず、購入状況の確認を再試行してください。")
        }
        await finish()
        // Finish has succeeded. A crash/write error leaves a harmless retryable entry.
        var values = try pending()
        values.removeAll { key($0) == id }
        try write(JSONEncoder().encode(values))
        return true
    }
}

/// Pending approvals have no completed transaction yet. Keep them across launches,
/// separately for each FATE LAB account; never clear them merely on logout.
@MainActor final class CardApprovalStore {
    private let read: () throws -> Data?
    private let write: (Data) throws -> Void
    init(read: @escaping () throws -> Data? = { try KeychainStore.readChecked(account: "purchase.card-approval.v1") },
         write: @escaping (Data) throws -> Void = { try KeychainStore.save($0, account: "purchase.card-approval.v1") }) {
        self.read = read; self.write = write
    }
    private func owners() throws -> Set<UUID> {
        guard let data = try read() else { return [] }
        return try JSONDecoder().decode(Set<UUID>.self, from: data)
    }
    func contains(_ owner: UUID) throws -> Bool { try owners().contains(owner) }
    func set(_ owner: UUID, pending: Bool) throws {
        var values = try owners()
        if pending { values.insert(owner) } else { values.remove(owner) }
        try write(JSONEncoder().encode(values))
    }
}
