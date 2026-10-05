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
    let kind: String?
    let isSaved: Bool?
    let createdAt: String?
    let updatedAt: String?
    let readingMessages: [MessageCount]?
    var birthData: BirthName? = nil
    var partnerProfileID: UUID? = nil

    struct BirthName: Codable {
        let nickname: String?
        let birthDate: String?
        let birthTime: String?
        let birthplace: String?
        let gender: String?
        let selfProfile: ReadingBirthProfile?
        let partner: ReadingBirthProfile?
        let relationshipType: String?

        enum CodingKeys: String, CodingKey {
            case nickname, birthDate, birthTime, birthplace, gender, partner, relationshipType
            case selfProfile = "self"
        }

        var profile: ReadingBirthProfile {
            .init(nickname: nickname, displayName: nil, birthDate: birthDate, birthTime: birthTime, birthplace: birthplace, gender: gender)
        }
    }

    var ownerDisplayName: String? {
        guard !isCompatibility, !isChat else { return nil }
        let name = birthData?.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? nil : name
    }

    struct MessageCount: Codable { let count: Int }
    var questionCount: Int { (readingMessages?.first?.count ?? 0) / 2 }

    enum CodingKeys: String, CodingKey {
        case id, title, kind
        case isSaved = "is_saved"
        case secretToken = "secret_token"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case readingMessages = "reading_messages"
        case birthData = "birth_data"
        case partnerProfileID = "partner_profile_id"
    }

    var isCompatibility: Bool { kind == "compatibility" }
    var isChat: Bool { kind == "chat" }

    func matchesCompatibility(selfReading: ReadingSummary, partner: PartnerProfile, relationshipType: String) -> Bool {
        guard isCompatibility, partnerProfileID == partner.id,
              !selfReading.isCompatibility, !selfReading.isChat,
              birthData?.relationshipType == relationshipType,
              let own = selfReading.birthData?.profile,
              let savedSelf = birthData?.selfProfile,
              let savedPartner = birthData?.partner else { return false }
        return savedSelf.matches(own) && savedSelf.nickname == own.nickname
            && savedPartner.matches(.init(nickname: nil, displayName: partner.displayName,
                birthDate: partner.birthDate, birthTime: partner.birthTime, birthplace: partner.birthplace, gender: partner.gender))
    }
}

struct ReadingBirthProfile: Codable {
    let nickname: String?
    let displayName: String?
    let birthDate: String?
    let birthTime: String?
    let birthplace: String?
    let gender: String?

    func matches(_ other: ReadingBirthProfile) -> Bool {
        guard let birthDate, !birthDate.isEmpty, let birthplace, !birthplace.isEmpty, let gender, !gender.isEmpty else { return false }
        return birthDate == other.birthDate && birthplace == other.birthplace && gender == other.gender
            && Self.normalizedTime(birthTime) == Self.normalizedTime(other.birthTime)
    }

    private static func normalizedTime(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "" }
        // Postgres may return seconds while the input form stores HH:mm.
        let parts = value.split(separator: ":", omittingEmptySubsequences: false)
        if parts.count == 3, parts[2] == "00" { return parts.prefix(2).joined(separator: ":") }
        return value
    }
}

struct CompatibilityHistory {
    let readings: [ReadingSummary]
    let complete: Bool

    struct Page: Decodable {
        struct Pagination: Decodable {
            let complete: Bool
            let nextCursor: UUID?
        }
        let conversations: [ReadingSummary]
        let compatibilityHistory: Pagination?
    }

    static func path(partnerID: UUID, cursor: UUID?) -> String {
        "/api/reading/conversations?compatibilityHistory=1&partnerId=\(partnerID.uuidString)"
            + (cursor.map { "&cursor=\($0.uuidString)" } ?? "")
    }

    @MainActor static func load(page: (UUID?) async throws -> Page) async throws -> CompatibilityHistory {
        var cursor: UUID?
        var records: [ReadingSummary] = []
        var seen = Set<UUID>()
        for _ in 0..<100 {
            let value = try await page(cursor)
            records.append(contentsOf: value.conversations)
            guard let pagination = value.compatibilityHistory else {
                // Older backends ignore the new query and return a capped list.
                return .init(readings: records, complete: false)
            }
            if pagination.complete {
                guard pagination.nextCursor == nil else { throw APIError.invalidResponse }
                return .init(readings: records.sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }, complete: true)
            }
            guard let next = pagination.nextCursor, next == value.conversations.last?.id,
                  cursor.map({ next.uuidString < $0.uuidString }) ?? true,
                  seen.insert(next).inserted else { throw APIError.invalidResponse }
            cursor = next
        }
        return .init(readings: records, complete: false)
    }
}

struct ReadingStatus: Decodable {
    let isPremium: Bool
    let used: Int
    let limit: Int
    let remaining: Int?
    let approvedCount: Int?
    let hasReading: Bool?
    let latestConversationID: UUID?

    enum CodingKeys: String, CodingKey {
        case isPremium, premium, used, limit, remaining, approvedCount, hasReading
        case latestConversationID = "latestConversationId"
    }

    var premium: Bool { isPremium }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        isPremium = try values.decodeIfPresent(Bool.self, forKey: .isPremium)
            ?? values.decode(Bool.self, forKey: .premium)
        used = try values.decode(Int.self, forKey: .used)
        limit = try values.decode(Int.self, forKey: .limit)
        remaining = try values.decodeIfPresent(Int.self, forKey: .remaining)
        approvedCount = try values.decodeIfPresent(Int.self, forKey: .approvedCount)
        hasReading = try values.decodeIfPresent(Bool.self, forKey: .hasReading)
        latestConversationID = try values.decodeIfPresent(UUID.self, forKey: .latestConversationID)
    }
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
    let relationshipLabel: String?

    enum CodingKeys: String, CodingKey {
        case id, birthplace, gender
        case displayName = "display_name"
        case birthDate = "birth_date"
        case birthTime = "birth_time"
        case relationshipType = "relationship_type"
        case relationshipLabel = "relationship_label"
    }
}

struct PartnerProfilesResponse: Codable {
    let partners: [PartnerProfile]
    let limit: Int
    let remaining: Int
}

struct BirthInput: Equatable, Codable {
    var relationshipStatus: String?
    var spouseConvention: String?
    var annualYunConvention: String?
    var workContext: String?
    var nickname = ""
    var date = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    var birthTime: Date?
    var birthplace = "東京都"
    var gender = "female"
}

struct GeneratedReport {
    let birthData: [String: Any]
    let calculatedData: [String: Any]
    let text: String
    let cards: [ReadingCard]
    let chartSections: [ChartSection]
    var conversationID: UUID?
    let saveOperationID: UUID
    let structuredSnapshot: [String: Any]?

    init(birthData: [String: Any], calculatedData: [String: Any], text: String, cards: [ReadingCard] = [], chartSections: [ChartSection] = [], conversationID: UUID? = nil, structuredSnapshot: [String: Any]? = nil, saveOperationID: UUID = UUID()) {
        self.saveOperationID = saveOperationID
        self.structuredSnapshot = structuredSnapshot
        self.birthData = birthData
        self.calculatedData = calculatedData
        self.text = text
        self.cards = cards
        self.chartSections = chartSections
        self.conversationID = conversationID
    }
}

struct StructuredReportResponse: Codable {
    let version: Int
    let reportText: String
    let cards: [ReadingCard]
    let chartSections: [ChartSection]?
    let conversationID: UUID?

    enum CodingKeys: String, CodingKey {
        case version, reportText, cards, chartSections
        case conversationID = "conversationId"
    }
}

struct ChartSection: Codable, Identifiable {
    let id: String
    let owner: String?
    let system: String
    let title: String
    let layout: String
    let table: ChartTable?
    let bars: [ChartBar]?
    let grid: [ChartGridItem]?
    let list: [ChartListItem]?
    let note: String?
}

struct ChartTable: Codable { let headers: [String]; let rows: [[String]] }
struct ChartBar: Codable, Identifiable { let label: String; let value: Double; let max: Double; let isZero: Bool; var id: String { label } }
struct ChartGridItem: Codable, Identifiable { let position: String; let value: String; var id: String { position } }
struct ChartListItem: Codable, Identifiable { let label: String; let value: String; let note: String?; var id: String { label } }

struct ReadingCardAccess: Codable {
    let locked: Bool
    let offerKey: String?
}

struct ReadingCard: Codable, Identifiable {
    let id: String
    let kind: String
    let tab: String?
    let scope: String?
    let title: String
    let summary: String
    let tags: [String]
    var access: ReadingCardAccess? = nil
    var timelineV3Calculation: TimelineV3DisplayMetadata? = nil
    let period: ReadingCardPeriod?
    let pages: [ReadingCardPage]
    let sections: [ReadingCardSection]?
    let evidence: [ReadingCardEvidence]

    // Presentation-only: keep original saved data and calculation periods intact.
    var isAnnualCatalogue: Bool {
        guard isTiming, scope != "couple", id.hasPrefix("turning-year-") else { return false }
        return period?.label.contains("立春から翌年の立春まで") == true
            || Array((sections ?? []).prefix(3).map(\.heading)) == ["恋愛・人との関わり", "仕事・活動", "暮らし・自分の時間"]
    }
    var displayPeriodLabel: String? {
        guard isAnnualCatalogue else { return period?.label }
        return period?.label.replacingOccurrences(of: "（立春から翌年の立春まで）", with: "")
    }
    var displaySections: [ReadingCardSection]? {
        return sections?.filter { section in
            if isTiming && section.heading == "根拠と期間" { return false }
            return !isAnnualCatalogue || section.heading != "対象期間と候補ラベル"
        }
    }
    var displayPages: [ReadingCardPage] {
        return pages.filter { page in
            if isTiming && page.label == "根拠と期間" { return false }
            return !isAnnualCatalogue || page.label != "対象期間と候補ラベル"
        }
    }

    /// Layout-only cleanup; saved manuscript and API data remain untouched.
    static func readerDisplayText(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }.joined(separator: "\n")
    }
    var readerSummary: String? {
        let value = Self.readerDisplayText(summary)
        let compact: (String) -> String = { $0.filter { !$0.isWhitespace } }
        let key = compact(value)
        guard !key.isEmpty, key != compact(title), !tags.contains(where: { compact($0) == key }) else { return nil }
        let bodies = displaySections?.map(\.body) ?? displayPages.map(\.text)
        guard !bodies.contains(where: { compact($0).contains(key) }) else { return nil }
        return value
    }

    struct DomainSummary { let label: String; let text: String }
    var domainSummaries: [DomainSummary] {
        guard isTiming else { return [] }
        if scope == "couple" {
            // Excerpt the confirmed annual manuscript; do not invent a marriage score.
            let text = (displaySections ?? []).map(\.body).joined(separator: "\n")
            let sentences = text.components(separatedBy: "。").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            return [("関係の節目", ["結婚", "婚約", "同居", "交際"]), ("すれ違いのケア", ["すれ違", "衝突", "食い違", "距離を", "関係を見直"])].compactMap { label, words in
                guard let sentence = sentences.first(where: { sentence in words.contains(where: sentence.contains) }) else { return nil }
                return DomainSummary(label: label, text: sentence + "。")
            }
        }
        if isAnnualCatalogue {
            return (displaySections ?? []).prefix(2).compactMap { section in
                guard let sentence = section.body.components(separatedBy: "。").first, !sentence.isEmpty else { return nil }
                return DomainSummary(label: section.heading, text: sentence + "。")
            }
        }
        // Quote existing complete sentences only. A broad tag alone must never
        // become a prediction about love, marriage or a job change.
        let sentences = summary.split(separator: "。").map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let domains = [("恋愛・結婚", ["恋愛", "結婚", "婚約", "交際", "恋人", "出会い"]),
                       ("仕事", ["仕事", "転職", "昇進", "職場", "肩書", "専門", "役目", "役割"])]
        return domains.compactMap { label, words in
            // The annual renderer retains every relationship signal in this
            // section. Its leading paragraph contains the calculated meanings;
            // subsequent paragraphs explain how to read them. Show the meanings
            // on the timeline and retain the complete section in the reader.
            if label == "恋愛・結婚", let relationship = sections?.first(where: {
                $0.claimId?.hasPrefix("timing-annual-") == true && $0.claimId?.hasSuffix("-relationships") == true
            }), !relationship.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let paragraphs = relationship.body.components(separatedBy: "\n\n")
                if let year = calendarYear,
                   relationship.claimId == "timing-annual-\(year)-relationships",
                   paragraphs.count > 1, let lead = paragraphs.first,
                   !lead.isEmpty, lead.hasSuffix("。"), summary.contains(lead),
                   // A saved/unknown format may put another calculated meaning
                   // in a later paragraph. In that case keep the whole section.
                   !sentences.contains(where: { relationship.body.contains($0 + "。") && !lead.contains($0 + "。") }) {
                    return DomainSummary(label: label, text: lead)
                }
                return DomainSummary(label: label, text: relationship.body)
            }
            let matching = sentences.filter { value in words.contains(where: value.contains) }
            guard !matching.isEmpty else { return nil }
            return DomainSummary(label: label, text: matching.map { $0 + "。" }.joined())
        }
    }

    var isTiming: Bool { kind == "timing" }
    var resolvedTab: String { tab ?? (kind == "timing" ? "timing" : kind == "chart" ? "chart" : "essence") }
    var body: String { displaySections?.map(\.body).joined(separator: "\n\n") ?? displayPages.map(\.text).joined(separator: "\n\n") }
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

struct ReadingCardSection: Codable, Identifiable {
    let heading: String
    let body: String
    let evidence: [ReadingCardEvidence]
    let termGloss: [ReadingTermGloss]
    let claimId: String?
    var id: String { claimId ?? "\(heading)|\(body)" }
}

struct ReadingTermGloss: Codable, Identifiable {
    let term: String
    let plain: String
    let system: String
    var id: String { "\(system)|\(term)" }
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
    let isSaved: Bool?
    let kind: String?

    enum CodingKeys: String, CodingKey {
        case id, title, kind
        case reportText = "report_text"
        case isSaved = "is_saved"
    }
}

struct ConversationDetail: Codable {
    let conversation: ConversationRecord
    let messages: [ReadingMessage]
}

struct SelfTimingHistory: Decodable {
    let cards: [ReadingCard]
    let referenceYear: Int

    static func merging(_ history: [ReadingCard], saved: [ReadingCard]) -> [ReadingCard] {
        var byYear: [Int: ReadingCard] = [:]
        for card in saved + history {
            guard card.isTiming, card.scope == "self", let year = card.calendarYear else { continue }
            byYear[year] = card
        }
        return byYear.sorted { $0.key < $1.key }.map(\.value)
    }
}

struct CoupleTimingHistory: Decodable {
    let cards: [ReadingCard]
    let initialYear: Int
    let hasMeetingSignal: Bool
    let referenceYear: Int
}

extension ReadingCard {
    var timelineDisplayTags: [String] {
        guard isTiming else { return [] }
        var seen = Set<String>()
        return tags.filter { $0.hasPrefix("#") && seen.insert($0).inserted }
    }

    var calendarYear: Int? {
        guard let label = period?.label,
              let range = label.range(of: #"\d{4}(?=年)"#, options: .regularExpression) else { return nil }
        return Int(label[range])
    }
}

struct CoupleAllYearsHistory: Decodable {
    struct RelationshipContext: Decodable { let note: String? }
    var relationshipContext: RelationshipContext? = nil
    struct Entry: Decodable { let year: Int; let label: String?; let contentStatus: String; let card: ReadingCard? }
    struct Group: Decodable { let from: Int; let to: Int; let years: [Int] }
    let status: String
    let meetingYear: Int?
    let referenceYear: Int
    let endYear: Int
    let minMeetingYear: Int
    let collapsedYears: [Int]
    let groups: [Group]
    let entries: [Entry]
    // Keep the first three calendar years from meeting visible (2014–2016, for example).
    var collapsibleYears: [Int] {
        guard let meetingYear else { return collapsedYears }
        return collapsedYears.filter { $0 < meetingYear || $0 >= meetingYear + 3 }
    }
}

struct CoupleMeetingSettings: Decodable {
    let meetingYear: Int?
    let minMeetingYear: Int
    let referenceYear: Int
}


extension ReadingCard {
    /// Domain IDs, never the card's position or narrative wording.
    var paidReadingLabel: String? {
        if scope == "couple" {
            switch id {
            case "compat-v24-5": return "良好な関係を築くコツ"
            case "compat-v24-6": return "障害になること"
            case "compat-v24-7": return "復縁の可能性"
            default: break
            }
        }
        guard resolvedTab == "timing", scope == "self" || scope == "couple",
              let label = period?.label,
              let range = label.range(of: #"(?<![0-9])[0-9]{4}(?=年)"#, options: .regularExpression),
              let year = Int(label[range]), year >= 2027 else { return nil }
        return "\(String(year))年・\(scope == "couple" ? "ふたり" : "あなた")の鑑定"
    }

    var showsReadingLock: Bool {
        if access?.locked == true { return true }
#if DEBUG
        // Design verification only. Never grants or sells an entitlement.
        if ProcessInfo.processInfo.arguments.contains("--preview-card-paywall") {
            return paidReadingLabel != nil
        }
#endif
        return false
    }
}


struct ReadingPurchaseTarget: Codable, Equatable {
    let conversationId: UUID
    let cardId: String
}

struct ReadingAccessResponse: Decodable {
    let enabled: Bool
    let productId: String?
    let premium: Bool?
    let credits: Int?
    let unlocked: Bool?
    let card: ReadingCard?
}
