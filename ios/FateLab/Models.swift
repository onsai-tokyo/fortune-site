import Foundation

struct Session: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: TimeInterval
    let user: AppUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case user
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try values.decode(String.self, forKey: .accessToken)
        refreshToken = try values.decode(String.self, forKey: .refreshToken)
        let expiresIn = try values.decodeIfPresent(TimeInterval.self, forKey: .expiresIn) ?? 3600
        expiresAt = Date().timeIntervalSince1970 + expiresIn
        user = try values.decode(AppUser.self, forKey: .user)
    }

    init(accessToken: String, refreshToken: String, expiresAt: TimeInterval, user: AppUser) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.user = user
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(accessToken, forKey: .accessToken)
        try values.encode(refreshToken, forKey: .refreshToken)
        try values.encode(max(0, expiresAt - Date().timeIntervalSince1970), forKey: .expiresIn)
        try values.encode(user, forKey: .user)
    }
}

struct AppUser: Codable, Identifiable {
    let id: UUID
    let email: String?
}

struct ReadingSummary: Codable, Identifiable {
    let id: UUID
    let secretToken: String?
    let title: String
    let createdAt: String?
    let updatedAt: String?
    let readingMessages: [MessageCount]?

    struct MessageCount: Codable { let count: Int }
    var questionCount: Int { (readingMessages?.first?.count ?? 0) / 2 }

    enum CodingKeys: String, CodingKey {
        case id, title
        case secretToken = "secret_token"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case readingMessages = "reading_messages"
    }
}

struct ReadingStatus: Codable {
    let premium: Bool
    let used: Int
    let limit: Int
    let remaining: Int?
    let approvedCount: Int?
}

struct ProfileTrait: Codable, Identifiable {
    let id: UUID
    let category: String
    let text: String
    let approvedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, category, text
        case approvedAt = "approved_at"
    }
}

struct PartnerProfile: Codable, Identifiable, Equatable {
    let id: UUID
    let displayName: String
    let birthDate: String
    let birthTime: String?
    let birthplace: String
    let gender: String
    let relationshipType: String

    enum CodingKeys: String, CodingKey {
        case id, birthplace, gender
        case displayName = "display_name"
        case birthDate = "birth_date"
        case birthTime = "birth_time"
        case relationshipType = "relationship_type"
    }
}

struct PartnerProfilesResponse: Codable {
    let partners: [PartnerProfile]
    let limit: Int
    let remaining: Int
}

struct BirthInput: Equatable, Codable {
    var nickname = ""
    var date = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    var hasTime = false
    var time = Calendar.current.date(from: DateComponents(hour: 12, minute: 0)) ?? Date()
    var birthplace = "東京都"
    var gender = "female"
}

struct GeneratedReport {
    let birthData: [String: Any]
    let calculatedData: [String: Any]
    let text: String
    let cards: [ReadingCard]
    var conversationID: UUID?

    init(birthData: [String: Any], calculatedData: [String: Any], text: String, cards: [ReadingCard] = [], conversationID: UUID? = nil) {
        self.birthData = birthData
        self.calculatedData = calculatedData
        self.text = text
        self.cards = cards
        self.conversationID = conversationID
    }
}

struct StructuredReportResponse: Codable {
    let version: Int
    let reportText: String
    let cards: [ReadingCard]
}

struct ReadingCard: Codable, Identifiable {
    let id: String
    let kind: String
    let title: String
    let summary: String
    let tags: [String]
    let period: ReadingCardPeriod?
    let pages: [ReadingCardPage]
    let evidence: [ReadingCardEvidence]

    var isTiming: Bool { kind == "timing" }
    var body: String { pages.map(\.text).joined(separator: "\n\n") }
}

struct ReadingCardPeriod: Codable { let label: String }

struct ReadingCardPage: Codable {
    let role: String
    let label: String
    let text: String
    let note: String?
}

struct ReadingCardEvidence: Codable {
    let family: String
    let system: String
    let detail: String
}

struct ReadingMessage: Codable, Identifiable {
    let id: UUID?
    let role: String
    var content: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, role, content
        case createdAt = "created_at"
    }
}

struct ConversationRecord: Codable {
    let id: UUID
    let title: String
    let reportText: String

    enum CodingKeys: String, CodingKey {
        case id, title
        case reportText = "report_text"
    }
}

struct ConversationDetail: Codable {
    let conversation: ConversationRecord
    let messages: [ReadingMessage]
}
