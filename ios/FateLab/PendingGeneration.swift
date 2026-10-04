import Foundation

struct PendingGeneration: Codable {
    let operationID: UUID
    let birthData: Data
    let payload: Data
    func birth() throws -> [String: Any] {
        guard let value = try JSONSerialization.jsonObject(with: birthData) as? [String: Any] else { throw APIError.invalidResponse }
        return value
    }
    func calculated() throws -> [String: Any] {
        guard let value = try JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let calculated = value["calculatedData"] as? [String: Any] else { throw APIError.invalidResponse }
        return calculated
    }
}

@MainActor
struct PendingGenerationStore {
    let storage: PendingReportStore
    private func key(_ owner: UUID) -> String { AccountStorage.key("generation.pending", userID: owner) }
    func load(owner: UUID) throws -> PendingGeneration? {
        guard let data = try storage.read(key(owner)) else { return nil }
        let value = try JSONDecoder().decode(PendingGeneration.self, from: data)
        _ = try value.birth(); _ = try value.calculated()
        return value
    }
    func save(_ value: PendingGeneration, owner: UUID) throws {
        if let old = try load(owner: owner), old.operationID != value.operationID || old.birthData != value.birthData || old.payload != value.payload {
            throw APIError.server("前の鑑定生成を確認してから再試行してください")
        }
        try storage.write(JSONEncoder().encode(value), key(owner))
    }
    func clear(operationID: UUID, owner: UUID) throws {
        guard try load(owner: owner)?.operationID == operationID else { return }
        try storage.remove(key(owner))
    }
}

struct PendingCompatibility: Codable {
    let operationID: UUID
    let partnerID: UUID
    let payload: Data
}

@MainActor
struct PendingCompatibilityStore {
    let storage: PendingReportStore
    private func key(_ owner: UUID) -> String { AccountStorage.key("compatibility.pending", userID: owner) }
    func load(owner: UUID) throws -> PendingCompatibility? {
        guard let data = try storage.read(key(owner)) else { return nil }
        let value = try JSONDecoder().decode(PendingCompatibility.self, from: data)
        guard try JSONSerialization.jsonObject(with: value.payload) is [String: Any] else { throw APIError.invalidResponse }
        return value
    }
    func save(_ value: PendingCompatibility, owner: UUID) throws {
        if let old = try load(owner: owner), old.operationID != value.operationID || old.partnerID != value.partnerID || old.payload != value.payload {
            throw APIError.server("前の相性鑑定の生成状況を確認してください")
        }
        try storage.write(JSONEncoder().encode(value), key(owner))
    }
    func clear(operationID: UUID, owner: UUID) throws {
        guard try load(owner: owner)?.operationID == operationID else { return }
        try storage.remove(key(owner))
    }
}

/// Registration snapshots are scoped to both deployment endpoints and owner.
struct PendingPartnerRegistration: Codable {
    let version: Int
    let operationID: UUID
    let ownerID: UUID
    let authEpoch: UInt64
    let environment: String
    let payload: Data
}

@MainActor
struct PendingPartnerRegistrationStore {
    let storage: PendingReportStore
    let environment: String
    private func key(_ owner: UUID) -> String {
        AccountStorage.key("partner.registration.\(environment)", userID: owner)
    }
    func load(owner: UUID) throws -> PendingPartnerRegistration? {
        guard let data = try storage.read(key(owner)) else { return nil }
        let value = try JSONDecoder().decode(PendingPartnerRegistration.self, from: data)
        guard value.version == 1, value.ownerID == owner, value.environment == environment,
              try JSONSerialization.jsonObject(with: value.payload) is [String: Any] else { throw APIError.invalidResponse }
        return value
    }
    func save(_ value: PendingPartnerRegistration, owner: UUID) throws {
        guard value.version == 1, value.ownerID == owner, value.environment == environment else { throw APIError.invalidResponse }
        if let old = try load(owner: owner), old.operationID != value.operationID || old.payload != value.payload {
            throw APIError.server("前の登録状況を確認するか、登録を取り消してください")
        }
        try storage.write(JSONEncoder().encode(value), key(owner))
    }
    func clear(operationID: UUID, owner: UUID) throws {
        guard try load(owner: owner)?.operationID == operationID else { return }
        try storage.remove(key(owner))
    }
}

struct PartnerRegistrationStatus: Decodable {
    let state: String
    let partner: PartnerProfile?
}
