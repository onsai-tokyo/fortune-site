import Foundation

/// Persist the exact save payload, including metadata unknown to the UI decoder.
struct PendingReport: Codable {
    let version: Int
    let operationID: UUID
    let payload: Data

    init(_ report: GeneratedReport) throws {
        version = 1; operationID = report.saveOperationID
        let cards = try JSONSerialization.jsonObject(with: JSONEncoder().encode(report.cards))
        let sections = try JSONSerialization.jsonObject(with: JSONEncoder().encode(report.chartSections))
        payload = try JSONSerialization.data(withJSONObject: [
            "birthData": report.birthData, "calculatedData": report.calculatedData,
            "reportText": report.text,
            "structuredReport": report.structuredSnapshot ?? ["version": 3, "reportText": report.text, "cards": cards, "chartSections": sections],
            "sourceSection": "鑑定全体"
        ], options: [.sortedKeys])
        _ = try restored()
    }

    func restored() throws -> GeneratedReport {
        guard version == 1,
              let object = try JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let birth = object["birthData"] as? [String: Any],
              let calculated = object["calculatedData"] as? [String: Any],
              let text = object["reportText"] as? String,
              let rawReport = object["structuredReport"] as? [String: Any] else { throw APIError.invalidResponse }
        let report = try JSONDecoder().decode(StructuredReportResponse.self, from: JSONSerialization.data(withJSONObject: rawReport))
        guard !text.isEmpty, text.utf16.count <= 60000, [2, 3].contains(report.version), report.reportText == text else { throw APIError.invalidResponse }
        return GeneratedReport(birthData: birth, calculatedData: calculated, text: text, cards: report.cards,
                               chartSections: report.chartSections ?? [], structuredSnapshot: rawReport, saveOperationID: operationID)
    }
}

@MainActor
struct PendingReportStore {
    var read: (String) throws -> Data? = { try KeychainStore.readChecked(account: $0) }
    var write: (Data, String) throws -> Void = { try KeychainStore.save($0, account: $1) }
    var remove: (String) throws -> Void = { try KeychainStore.remove(account: $0) }
    private func key(_ owner: UUID) -> String { AccountStorage.key("report.pending", userID: owner) }
    func load(owner: UUID) throws -> PendingReport? {
        guard let data = try read(key(owner)) else { return nil }
        let value = try JSONDecoder().decode(PendingReport.self, from: data)
        _ = try value.restored()
        return value
    }
    func save(_ value: PendingReport, owner: UUID) throws {
        if let existing = try load(owner: owner),
           existing.operationID != value.operationID || existing.payload != value.payload {
            throw APIError.server("未保存の鑑定があります。先に保存を完了してください")
        }
        try write(JSONEncoder().encode(value), key(owner))
    }
    func clear(operationID: UUID, owner: UUID) throws {
        guard try load(owner: owner)?.operationID == operationID else { return }
        try remove(key(owner))
    }
}
