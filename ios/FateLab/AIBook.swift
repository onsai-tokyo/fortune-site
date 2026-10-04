import Foundation

struct AIBookStatus: Decodable {
    let enabled: Bool
    let monthlyCredits: Int
    let remaining: Int
    let memberRemaining: Int
    let purchasedRemaining: Int
    let memberExpiresAt: String?
    let productId: String
}
struct AIBook: Decodable, Identifiable {
    let id: UUID
    let title: String
    let targetTitle: String
    let theme: String
    let question: String
    let state: String
    let createdAt: String
    let deliveredAt: String?
    let document: Document?
    let sources: [Source]
    struct Document: Decodable {
        let title: String
        let summary: String
        let answer: String
        var conclusion: String? = nil
        var highlights: [String]? = nil
        let sections: [Section]
        let actions: [String]
    }
    struct Section: Decodable {
        let heading: String
        let body: String
        let sourceId: String
        let quote: String
    }
    struct Source: Decodable, Identifiable {
        let id: String
        let title: String
        let text: String
        let version: String
    }
    var isPending: Bool { ["queued", "generating", "review"].contains(state) }
    var stateLabel: String {
        switch state {
        case "queued": "受付済み"
        case "generating": "作成中"
        case "review": "確認中"
        case "delivered": "お届け済み"
        case "failed": "作成できませんでした"
        default: "状態を確認しています"
        }
    }
}
struct AIBookPage: Decodable { let books: [AIBook]; let nextCursor: UUID? }
struct AIBookResponse: Decodable { let book: AIBook? }
struct AIBookValidation: Decodable { let valid: Bool }
struct PendingAIBook: Codable {
    let operationID: UUID
    let sourceID: UUID
    let theme: String
    let question: String
    var focusCardID: String? = nil
    var body: [String: String] {
        var value = ["operationId": operationID.uuidString, "sourceId": sourceID.uuidString, "theme": theme, "question": question]
        if let focusCardID { value["focusCardId"] = focusCardID }
        return value
    }
}
