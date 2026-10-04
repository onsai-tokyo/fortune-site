import XCTest
@testable import FateLab

@MainActor
final class PendingReportTests: XCTestCase {
    private func report() -> GeneratedReport {
        GeneratedReport(birthData: ["birthDate": "2000-01-01"], calculatedData: ["longitude": 139.123456789], text: "本文",
                        structuredSnapshot: ["version": 3, "cards": [], "reportText": "本文", "generatorVersion": "synthetic-v1", "futureMetadata": ["ids": ["x", "y"]]])
    }
    private func store() -> PendingReportStore {
        let memory = MemoryAuthStorage()
        return .init(read: { try memory.retrieve(key: $0) }, write: { try memory.store(key: $1, value: $0) }, remove: { try memory.remove(key: $0) })
    }
    func testRestartPreservesOperationAndCompletePayload() throws {
        let original = report(), storage = store(), owner = UUID()
        let snapshot = try PendingReport(original)
        try storage.save(snapshot, owner: owner)
        let loaded = try XCTUnwrap(storage.load(owner: owner))
        let restored = try loaded.restored()
        XCTAssertEqual(restored.saveOperationID, original.saveOperationID)
        XCTAssertEqual(restored.structuredSnapshot?["generatorVersion"] as? String, "synthetic-v1")
        XCTAssertEqual(try PendingReport(restored).payload, snapshot.payload)
        XCTAssertNil(try storage.load(owner: UUID()))
    }
    func testPendingResultCannotBeReplacedOrClearedByAnotherOperation() throws {
        let storage = store(), owner = UUID(), snapshot = try PendingReport(report())
        try storage.save(snapshot, owner: owner)
        XCTAssertThrowsError(try storage.save(PendingReport(report()), owner: owner))
        try storage.clear(operationID: UUID(), owner: owner)
        XCTAssertNotNil(try storage.load(owner: owner))
        try storage.clear(operationID: snapshot.operationID, owner: owner)
        XCTAssertNil(try storage.load(owner: owner))
    }
    func testCorruptAndUnsupportedSnapshotsFailWithoutDeletion() throws {
        let snapshot = try PendingReport(report())
        var object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(snapshot)) as! [String: Any]
        object["version"] = 999
        let data = try JSONSerialization.data(withJSONObject: object)
        var deleted = false
        let storage = PendingReportStore(read: { _ in data }, write: { _, _ in }, remove: { _ in deleted = true })
        XCTAssertThrowsError(try storage.load(owner: UUID()))
        XCTAssertFalse(deleted)
        XCTAssertThrowsError(try PendingReport(GeneratedReport(birthData: [:], calculatedData: [:], text: "body", structuredSnapshot: ["version":3,"cards":[],"reportText":"other"])))
    }
}

@MainActor
final class ExistingCompatibilityTests: XCTestCase {
    private let partnerID = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
    private let savedID = UUID(uuidString: "33333333-3333-4333-8333-333333333333")!

    private var birth: [String: String] {
        ["nickname": "合成本人", "birthDate": "2000-01-01", "birthTime": "03:02", "birthplace": "東京都", "gender": "female"]
    }

    private func partner(time: String? = nil) -> PartnerProfile {
        .init(id: partnerID, displayName: "合成相手", birthDate: "2000-02-02", birthTime: time,
              birthplace: "大阪府", gender: "male", relationshipType: "romantic", relationshipLabel: "元恋人")
    }

    private func reading(kind: String = "compatibility", own: [String: String]? = nil, type: String = "romantic", profileID: UUID? = nil,
                         partnerTime: String = "", recordID: UUID? = nil) throws -> ReadingSummary {
        let source: [String: Any] = ["self": own ?? birth, "relationshipType": type,
                                   "partner": ["displayName": "合成相手", "birthDate": "2000-02-02", "birthTime": partnerTime, "birthplace": "大阪府", "gender": "male"]]
        let data: [String: Any] = ["id": (recordID ?? savedID).uuidString, "title": "保存した鑑定", "kind": kind,
                                  "partner_profile_id": (profileID ?? partnerID).uuidString, "birth_data": kind == "self" ? (own ?? birth) : source]
        return try JSONDecoder().decode(ReadingSummary.self, from: JSONSerialization.data(withJSONObject: data))
    }

    private func report(labels: [String] = ["相性", "元恋人"]) -> StructuredReportResponse {
        .init(version: 3, reportText: "保存した本文", cards: [
            .init(id: "saved-couple", kind: "essence", tab: "essence", scope: "couple", title: "保存した章", summary: "保存した要約",
                  tags: labels, period: nil, pages: [], sections: [], evidence: [])
        ], chartSections: nil, conversationID: savedID)
    }

    func testExistingPairOpensSavedConversationWithoutGeneratingOrCheckingPoints() async throws {
        let own = try reading(kind: "self"), saved = try reading()
        var reads = 0, cardIDs: [UUID] = [], generations = 0
        let result = try await CompatibilityOpening.resolve(selfReading: own, partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
            readings: { reads += 1; return .init(readings: [saved, own], complete: true) }, cards: { id in cardIDs.append(id); return self.report() },
            generate: { generations += 1; throw APIError.paymentRequired("利用回数なし") })
        guard case .saved(let id) = result else { return XCTFail("Existing result must be opened") }
        XCTAssertEqual(id, savedID)
        XCTAssertEqual(reads, 1)
        XCTAssertEqual(cardIDs, [savedID])
        XCTAssertEqual(generations, 0)
    }

    func testHistoryFailureNeverFallsThroughToPaidGeneration() async throws {
        var generations = 0
        do {
            _ = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
                readings: { throw URLError(.notConnectedToInternet) }, cards: { _ in self.report() },
                generate: { generations += 1; return self.report() })
            XCTFail("History failure must remain observable")
        } catch { XCTAssertEqual((error as? URLError)?.code, .notConnectedToInternet) }
        XCTAssertEqual(generations, 0)
    }

    func testSavedResultFailureNeverFallsThroughToPaidGeneration() async throws {
        let saved = try reading()
        var generations = 0
        do {
            _ = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
                readings: { .init(readings: [saved], complete: true) }, cards: { _ in throw APIError.http(status: 404, message: "削除済み") },
                generate: { generations += 1; return self.report() })
            XCTFail("Deleted saved result must not silently recreate")
        } catch {}
        XCTAssertEqual(generations, 0)
    }

    func testNewCombinationUsesExistingGenerationExactlyOnce() async throws {
        var generations = 0, cardReads = 0
        let result = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
            readings: { .init(readings: [], complete: true) }, cards: { _ in cardReads += 1; return self.report() },
            generate: { generations += 1; return self.report() })
        guard case .generated = result else { return XCTFail("New combination should retain generation") }
        XCTAssertEqual(generations, 1)
        XCTAssertEqual(cardReads, 0)
    }

    func testDifferentPeopleBirthInputsAndRelationshipTypesDoNotMatch() throws {
        let own = try reading(kind: "self")
        XCTAssertTrue(try reading().matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        XCTAssertFalse(try reading(profileID: UUID()).matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        XCTAssertFalse(try reading(type: "friend").matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        XCTAssertFalse(try reading(kind: "chat").matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        for key in ["nickname", "birthDate", "birthTime", "birthplace", "gender"] {
            var changed = birth; changed[key] = "different"
            XCTAssertFalse(try reading(own: changed).matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"), key)
        }
        XCTAssertFalse(try reading().matchesCompatibility(selfReading: reading(), partner: partner(), relationshipType: "romantic"))
    }

    func testUnknownBirthTimeIsNotMidnightAndPostgresSecondsAreEquivalent() throws {
        let own = try reading(kind: "self")
        XCTAssertTrue(try reading().matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        XCTAssertFalse(try reading(partnerTime: "00:00").matchesCompatibility(selfReading: own, partner: partner(), relationshipType: "romantic"))
        XCTAssertTrue(try reading(partnerTime: "03:02").matchesCompatibility(selfReading: own, partner: partner(time: "03:02:00"), relationshipType: "romantic"))
    }

    func testDifferentRelationshipLabelDoesNotReuseKnownOtherContext() async throws {
        let saved = try reading()
        var generations = 0
        let result = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "夫婦",
            readings: { .init(readings: [saved], complete: true) }, cards: { _ in self.report() }, generate: { generations += 1; return self.report(labels: ["夫婦"]) })
        guard case .generated = result else { return XCTFail("Former partner report must not replace married context") }
        XCTAssertEqual(generations, 1)
    }

    func testLegacyPairWithoutLabelStillOpensItsSavedText() async throws {
        let saved = try reading()
        var generations = 0
        let result = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
            readings: { .init(readings: [saved], complete: true) }, cards: { _ in self.report(labels: ["相性"]) }, generate: { generations += 1; return self.report() })
        guard case .saved(let id) = result else { return XCTFail("Legacy result must remain accessible") }
        XCTAssertEqual(id, savedID)
        XCTAssertEqual(generations, 0)
    }

    func testIncompleteOldBackendHistoryDoesNotPermitNewGeneration() async throws {
        var generations = 0
        do {
            _ = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
                readings: { .init(readings: [], complete: false) }, cards: { _ in self.report() },
                generate: { generations += 1; return self.report() })
            XCTFail("An old capped response is not proof of absence")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("新しい鑑定は作成していません"))
        }
        XCTAssertEqual(generations, 0)
    }

    func testIncompleteOldBackendHistoryCanStillOpenFoundResult() async throws {
        let saved = try reading()
        var generations = 0
        let result = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
            readings: { .init(readings: [saved], complete: false) }, cards: { _ in self.report() },
            generate: { generations += 1; return self.report() })
        guard case .saved(let id) = result else { return XCTFail("Found result remains usable on the old backend") }
        XCTAssertEqual(id, savedID)
        XCTAssertEqual(generations, 0)
    }

    func testSavedResultBeyondFirstHundredIsReadWithoutNewGeneration() async throws {
        let firstPage = try (1...100).reversed().map { number in
            try reading(type: "friend", recordID: UUID(uuidString: String(format: "4000%04X-4444-4444-8444-444444444444", number))!)
        }
        let saved = try reading()
        var cursors: [UUID?] = [], generations = 0
        let history = try await CompatibilityHistory.load { cursor in
            cursors.append(cursor)
            return cursor == nil
                ? .init(conversations: firstPage, compatibilityHistory: .init(complete: false, nextCursor: firstPage.last!.id))
                : .init(conversations: [saved], compatibilityHistory: .init(complete: true, nextCursor: nil))
        }
        XCTAssertEqual(cursors, [nil, firstPage.last!.id])
        XCTAssertTrue(history.complete)
        XCTAssertEqual(history.readings.count, 101)
        let result = try await CompatibilityOpening.resolve(selfReading: reading(kind: "self"), partner: partner(), relationshipType: "romantic", relationshipLabel: "元恋人",
            readings: { history }, cards: { _ in self.report() }, generate: { generations += 1; return self.report() })
        guard case .saved(let id) = result else { return XCTFail("Older result should be reachable") }
        XCTAssertEqual(id, savedID)
        XCTAssertEqual(generations, 0)
        let url = try XCTUnwrap(URLComponents(string: CompatibilityHistory.path(partnerID: partnerID, cursor: savedID)))
        XCTAssertEqual(url.path, "/api/reading/conversations")
        XCTAssertEqual(url.queryItems?.first(where: { $0.name == "partnerId" })?.value, partnerID.uuidString)
        XCTAssertEqual(url.queryItems?.first(where: { $0.name == "cursor" })?.value, savedID.uuidString)
    }

    func testMissingPaginationMetadataRemainsIncomplete() async throws {
        let saved = try reading()
        var reads = 0
        let history = try await CompatibilityHistory.load { _ in
            reads += 1
            return .init(conversations: [saved], compatibilityHistory: nil)
        }
        XCTAssertEqual(reads, 1)
        XCTAssertEqual(history.readings.first?.id, savedID)
        XCTAssertFalse(history.complete)
    }

    func testRepeatedCursorFailsWithoutClaimingHistoryComplete() async throws {
        let saved = try reading()
        var reads = 0
        do {
            _ = try await CompatibilityHistory.load { _ in
                reads += 1
                return .init(conversations: [saved], compatibilityHistory: .init(complete: false, nextCursor: saved.id))
            }
            XCTFail("Repeated cursor must not hide missing history")
        } catch {}
        XCTAssertEqual(reads, 2)
    }
}

final class TimingPresentationRegressionTests: XCTestCase {
    private let encounter = "新しい人との出会いや、人と交流する機会が広がりやすい時期です。"
    private let review = "これまで見えていなかった食い違いが表に出て、関係の前提を確かめ直す場面が生まれやすい時期です。"
    private let decision = "これからどのように関わっていくかを、日々の生活も踏まえて具体的に決めやすい時期です。"
    private let explanation = "一緒に決めたいことと、まず自分で整理したいことを分けてみてください。"

    private func card(year: Int = 2028, body: String, summary: String, claimID: String? = "timing-annual-2028-relationships") -> ReadingCard {
        .init(id: "turning-year-\(year)", kind: "timing", tab: "timing", scope: "self", title: "年のテーマ", summary: summary,
              tags: [], period: .init(label: "\(year)年（33歳になる年）"), pages: [],
              sections: [.init(heading: "人との関係", body: body, evidence: [], termGloss: [], claimId: claimID)], evidence: [])
    }

    func testTimelineKeepsEveryCalculatedRelationshipMeaningAndReaderKeepsExplanation() throws {
        let lead = encounter + review
        let body = lead + "\n\n" + explanation
        let reading = card(body: body, summary: "役割を見直すことがテーマです。" + lead)
        XCTAssertEqual(try XCTUnwrap(reading.domainSummaries.first).text, lead)
        XCTAssertEqual(reading.sections?.first?.body, body)
        XCTAssertEqual(reading.body, body, "The full saved text remains available in the detail reader")
    }

    func testRecurringCalculatedThemeRemainsTheSameWithoutInventingYearDifferences() throws {
        let cards = [2019, 2024, 2028].map { year in
            card(year: year, body: decision + "\n\n" + explanation, summary: decision,
                 claimID: "timing-annual-\(year)-relationships")
        }
        for reading in cards {
            XCTAssertEqual(try XCTUnwrap(reading.domainSummaries.first).text, decision)
            XCTAssertTrue(reading.body.contains(explanation))
        }
    }

    func testAdditionalCalculatedMeaningInLaterParagraphIsNotOmitted() throws {
        let body = encounter + "\n\n" + review + "\n\n" + explanation
        let reading = card(body: body, summary: encounter + review)
        XCTAssertEqual(try XCTUnwrap(reading.domainSummaries.first).text, body)
    }

    func testUnrecognizedAnnualSectionFormatKeepsItsCompleteBody() throws {
        let body = "この年に大切にしたい関わり方です。\n\n" + review
        let reading = card(body: body, summary: encounter)
        XCTAssertEqual(try XCTUnwrap(reading.domainSummaries.first).text, body)
        let yearMismatch = card(body: encounter + "\n\n" + explanation, summary: encounter, claimID: "timing-annual-2024-relationships")
        XCTAssertEqual(try XCTUnwrap(yearMismatch.domainSummaries.first).text, yearMismatch.body)
        let unversioned = card(body: encounter + "\n\n" + explanation, summary: encounter, claimID: "timing-annual-custom-relationships")
        XCTAssertEqual(try XCTUnwrap(unversioned.domainSummaries.first).text, unversioned.body)
    }

    func testSingleParagraphAndIncompleteLeadAreNotTruncated() throws {
        let single = card(body: encounter + explanation, summary: encounter)
        XCTAssertEqual(try XCTUnwrap(single.domainSummaries.first).text, single.body)
        let incomplete = card(body: "新しい人との出会い\n\n" + review, summary: "新しい人との出会い" + review)
        XCTAssertEqual(try XCTUnwrap(incomplete.domainSummaries.first).text, incomplete.body)
    }

    func testLegacyCardStillQuotesOnlyItsExistingSummarySentences() throws {
        let reading = ReadingCard(id: "old-year", kind: "timing", tab: "timing", scope: "self", title: "年のテーマ",
                                  summary: encounter + "仕事の役割を見直します。", tags: ["結婚"], period: nil, pages: [], sections: nil, evidence: [])
        XCTAssertEqual(reading.domainSummaries.first(where: { $0.label == "恋愛・結婚" })?.text, encounter)
        XCTAssertEqual(reading.domainSummaries.first(where: { $0.label == "仕事" })?.text, "仕事の役割を見直します。")
        XCTAssertFalse(reading.domainSummaries.contains(where: { $0.text.contains("結婚") }))
    }
}

final class TimelineTagPresentationTests: XCTestCase {
    func testTagsPreserveOrderAndPartialPeriodWithoutInternalLabels() throws {
        let data = Data(##"{"id":"turning-year-2018","kind":"timing","scope":"self","title":"年のテーマ","summary":"概要","tags":["時期","#婚期","#婚期","#出会いの時期（年内の一部）"],"pages":[],"evidence":[]}"##.utf8)
        let card = try JSONDecoder().decode(ReadingCard.self, from: data)
        XCTAssertEqual(card.timelineDisplayTags, ["#婚期", "#出会いの時期（年内の一部）"])
        XCTAssertEqual(card.tags.count, 4)
    }
    func testRelationshipNoteIsOptionalForSavedHistory() throws {
        let object: [String: Any] = ["status":"ready", "referenceYear":2026, "endYear":2045, "minMeetingYear":1995, "collapsedYears":[], "groups":[], "entries":[]]
        let decode: ([String: Any]) throws -> CoupleAllYearsHistory = { try JSONDecoder().decode(CoupleAllYearsHistory.self, from: JSONSerialization.data(withJSONObject: $0)) }
        XCTAssertNil(try decode(object).relationshipContext)
        var updated = object
        updated["relationshipContext"] = ["note":"保存された関係についての注記", "breakupYear":NSNull()]
        XCTAssertEqual(try decode(updated).relationshipContext?.note, "保存された関係についての注記")
    }
}

@MainActor
final class BookshelfCacheTests: XCTestCase {
    func testSameSessionRestoresSnapshotAndAccountChangeDropsIt() {
        let cache = BookshelfMemoryCache()
        let first = AccountScope(userID: UUID(), epoch: 1)
        let cursor = UUID()
        cache.store(.init(readings: [], books: [], nextCursor: cursor), for: first)
        XCTAssertEqual(cache.value(for: first)?.nextCursor, cursor)
        XCTAssertNil(cache.value(for: AccountScope(userID: UUID(), epoch: 1)))
        XCTAssertNil(cache.value(for: first))
    }
    func testSigningBackIntoSameAccountDoesNotReuseOldSession() {
        let cache = BookshelfMemoryCache(), user = UUID()
        cache.store(.init(readings: [], books: [], nextCursor: UUID()), for: AccountScope(userID: user, epoch: 1))
        XCTAssertNil(cache.value(for: AccountScope(userID: user, epoch: 2)))
    }
}