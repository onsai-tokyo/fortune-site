import XCTest
import Supabase
@testable import FateLab

final class Feedback133Tests: XCTestCase {
    @MainActor func testPartnerTabsReuseReportAndDifferentConversationReloads() async throws {
        let storage = AuthSessionStorage(base: MemoryAuthStorage())
        let client = SupabaseClient(supabaseURL: URL(string: "https://example.supabase.co")!, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, autoRefreshToken: false)))
        let auth = AuthStore(adapter: AuthSessionAdapter(storage: storage, client: client), readLegacy: { nil }, removeLegacy: {})
        await auth.restore()
        var calls = 0
        let model = PartnerReadingModel { _, _ in
            calls += 1
            return StructuredReportResponse(version: 1, reportText: "sample", cards: [], chartSections: nil, conversationID: nil)
        }
        let id = UUID()
        await model.load(id: id, auth: auth)
        await model.load(id: id, auth: auth)
        XCTAssertEqual(calls, 1)
        await model.load(id: UUID(), auth: auth)
        XCTAssertEqual(calls, 2)
    }
    func testNativeLegalDocumentsIncludeFullSectionsAndSharingDisclosure() throws {
        let bundle = Bundle(for: AuthStore.self)
        for name in ["terms", "privacy"] {
            let url = try XCTUnwrap(bundle.url(forResource: name, withExtension: "json"))
            let sections = try JSONDecoder().decode([LegalSection].self, from: Data(contentsOf: url))
            XCTAssertGreaterThan(sections.count, 10)
            XCTAssertTrue(sections.flatMap(\.paragraphs).contains { $0.contains("Anthropic") })
            XCTAssertTrue(sections.allSatisfy { !$0.paragraphs.isEmpty })
        }
        XCTAssertEqual(LegalDocument.matching(AppConfig.websiteBaseURL.appendingPathComponent("terms")), .terms)
        XCTAssertNil(LegalDocument.matching(URL(string: "https://example.com/terms")!))
    }
}
