import Foundation

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
