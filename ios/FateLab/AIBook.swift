import Foundation
import Combine

struct AIBookStatus: Decodable {
    let enabled: Bool
    let monthlyCredits: Int
    let remaining: Int
    let memberRemaining: Int
    let purchasedRemaining: Int
    let memberExpiresAt: String?
    let productId: String
    var premium: Bool? = nil
    var reviewRemaining: Int? = nil
    var trialRemaining: Int? = nil
    var creditBreakdown: String {
        var parts = ["会員分 \(memberRemaining)通"]
        if let trialRemaining, trialRemaining > 0 { parts.insert("初回無料 \(trialRemaining)通", at: 0) }
        if purchasedRemaining > 0 { parts.append("単品購入分 \(purchasedRemaining)通") }
        if let reviewRemaining, reviewRemaining > 0 { parts.append("審査用追加分 \(reviewRemaining)通") }
        return parts.joined(separator: " · ")
    }
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
    var failureCode: String? = nil
    var failureMessage: String {
        if failureCode == "BOOK_REFUSED" || failureCode == "BOOK_DOCUMENT_POLICY" {
            return "このご相談は鑑定で扱える範囲を超えていたため、利用枠をお戻ししました。相談内容は保存されています。"
        }
        return "作成を完了できなかったため、利用枠をお戻ししました。相談内容はそのままで再試行できます。"
    }
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

/// A purchase dismissal may resume only the exact draft and account that requested it.
@MainActor
final class BookMembershipContinuation: ObservableObject {
    private var draft: PendingAIBook?
    private var owner: AccountScope?
    private var approved = false

    func prepare(_ draft: PendingAIBook, owner: AccountScope) {
        self.draft = draft; self.owner = owner; approved = false
    }
    func authorize(owner: AccountScope, premium: Bool, remaining: Int) -> Bool {
        guard self.owner == owner, draft != nil, premium, remaining > 0 else { return false }
        approved = true
        return true
    }
    func consume(owner: AccountScope) -> PendingAIBook? {
        defer { cancel() }
        guard self.owner == owner, approved else { return nil }
        return draft
    }
    func cancel() { draft = nil; owner = nil; approved = false }
}
