import Foundation

struct PendingQuestion: Codable {
    let operationID: UUID
    let conversationID: UUID
    let question: String
    var sourceConversationID: UUID? = nil
    var createdConversationID: UUID? = nil
}

@MainActor
struct PendingQuestionStore {
    var namespace = "question.pending"
    var read: (String) throws -> Data? = { try KeychainStore.readChecked(account: $0) }
    var write: (Data, String) throws -> Void = { try KeychainStore.save($0, account: $1) }
    var remove: (String) throws -> Void = { try KeychainStore.remove(account: $0) }
    private func key(_ owner: UUID, _ conversation: UUID) -> String {
        AccountStorage.key("\(namespace).\(conversation.uuidString.lowercased())", userID: owner)
    }
    func load(owner: UUID, conversation: UUID) throws -> PendingQuestion? {
        guard let data = try read(key(owner, conversation)) else { return nil }
        let pending = try JSONDecoder().decode(PendingQuestion.self, from: data)
        guard pending.conversationID == conversation else { throw APIError.invalidResponse }
        return pending
    }
    func save(_ pending: PendingQuestion, owner: UUID) throws {
        try write(JSONEncoder().encode(pending), key(owner, pending.conversationID))
    }
    func clear(owner: UUID, conversation: UUID) throws { try remove(key(owner, conversation)) }
}

struct QuestionOperationStatus: Decodable {
    struct Result: Decodable { let answer: String; let suggestions: [String] }
    let state: String
    let result: Result?
    let code: String?
}
