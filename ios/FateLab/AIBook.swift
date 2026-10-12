import Foundation
import Combine
import DeviceCheck

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
    var trialEligible: Bool? = nil
    var trialPaused: Bool? = nil
    var trialEnabled: Bool? = nil
    var trialVerificationPending: Bool? = nil
    var trialExpiresAt: String? = nil
    var trialExpiryLabel: String? {
        guard let trialExpiresAt else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: trialExpiresAt) else { return nil }
        let display = DateFormatter(); display.locale = Locale(identifier: "ja_JP"); display.dateFormat = "M月d日 HH:mm"
        return display.string(from: date)
    }
    var canCreateBook: Bool { premium == true || (trialRemaining ?? 0) > 0 }
    var canTryFreeBook: Bool { (trialRemaining ?? 0) > 0 || trialEligible == true }
    var canPurchaseExtraBook: Bool {
        enabled && premium == true && memberRemaining == 0 && remaining == 0
    }
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
    var isTrial: Bool? = nil
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

/// Purchase-screen draft; separate from a submitted request so restoring it
/// never submits or consumes a credit by itself.
struct AIBookComposerDraft: Codable {
    let sourceID: UUID?
    let theme: String
    let question: String
    let focusCardID: String?
    let focusTitle: String?
}

/// A purchase dismissal may resume only the exact draft and account that requested it.
@MainActor
final class BookMembershipContinuation: ObservableObject {
    private var draft: PendingAIBook?
    private var owner: AccountScope?
    private var approved = false
    var hasPendingDraft: Bool { draft != nil }

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

struct TrialDeviceRequest: Codable {
    let requestId: UUID
    let token: String
    @MainActor private static var preparations: [String: Task<TrialDeviceRequest, Error>] = [:]
    @MainActor static func prepare(key: String, tokenGenerator: (@MainActor @Sendable () async throws -> Data)? = nil) async throws -> TrialDeviceRequest {
        if let pending = preparations[key] { return try await pending.value }
        if let data = try KeychainStore.readChecked(account: key) { return try JSONDecoder().decode(Self.self, from: data) }
        let pending = Task { @MainActor in
            let data: Data
            if let tokenGenerator { data = try await tokenGenerator() }
            else {
                guard DCDevice.current.isSupported else { throw APIError.invalidResponse }
                data = try await withCheckedThrowingContinuation { continuation in
                    DCDevice.current.generateToken { data, error in
                        if let data { continuation.resume(returning: data) }
                        else { continuation.resume(throwing: error ?? APIError.invalidResponse) }
                    }
                }
            }
            let value = Self(requestId: UUID(), token: data.base64EncodedString())
            try KeychainStore.save(JSONEncoder().encode(value), account: key)
            return value
        }
        preparations[key] = pending
        defer { preparations.removeValue(forKey: key) }
        return try await pending.value
    }
}
struct TrialDeviceResponse: Decodable { let state: String }
