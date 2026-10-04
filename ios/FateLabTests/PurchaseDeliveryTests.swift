import XCTest
@testable import FateLab

@MainActor final class PurchaseDeliveryTests: XCTestCase {
    private let owner = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!
    private var purchase: PendingPurchase { PendingPurchase(transactionID: "synthetic-transaction", ownerID: owner, signedTransaction: "synthetic-jws", allowOwnerTransfer: false) }
    private func response(_ extra: String = "") throws -> ApplePurchaseVerification {
        try JSONDecoder().decode(ApplePurchaseVerification.self, from: Data((extra.isEmpty
            ? "{\"verified\":true,\"delivery\":\"mirrored\",\"transactionId\":\"synthetic-transaction\",\"ownerId\":\"\(owner.uuidString)\"}"
            : extra).utf8))
    }

    func testMalformedSkippedAndWrongOwnerNeverFinish() async throws {
        let bad = ["{}", "{\"verified\":true}",
            // Current deployed backend acknowledgement omits delivery identity.
            "{\"verified\":true,\"subscription\":{\"status\":\"active\",\"expiresAt\":\"2026-09-07T00:00:00Z\",\"skipped\":false},\"correlationId\":\"synthetic\"}",
            "{\"verified\":true,\"delivery\":\"owner_mismatch\",\"transactionId\":\"synthetic-transaction\",\"ownerId\":null}",
            "{\"verified\":false,\"delivery\":\"mirrored\",\"transactionId\":\"synthetic-transaction\",\"ownerId\":\"\(owner.uuidString)\"}",
            "{\"verified\":true,\"delivery\":\"mirrored\",\"transactionId\":\"other\",\"ownerId\":\"\(owner.uuidString)\"}",
            "{\"verified\":true,\"delivery\":\"mirrored\",\"transactionId\":\"synthetic-transaction\",\"ownerId\":\"22222222-2222-4222-8222-222222222222\"}"]
        for body in bad {
            var data: Data?, finished = false
            let queue = PurchaseDelivery(read: { data }, write: { data = $0 })
            do { _ = try await queue.deliver(purchase, isCurrent: { true }, mirror: { try self.response(body) }, finish: { finished = true }); XCTFail("invalid acknowledgement") } catch {}
            XCTAssertFalse(finished)
            XCTAssertEqual(try queue.pending(), [purchase])
        }
    }

    func testMirrorFailureSurvivesRestartAndFinishesOnlyAfterAcknowledgement() async throws {
        var data: Data?, events: [String] = []
        let write: (Data) throws -> Void = { data = $0; events.append("persist") }
        let first = PurchaseDelivery(read: { data }, write: write)
        do { _ = try await first.deliver(purchase, isCurrent: { true }, mirror: { throw URLError(.notConnectedToInternet) }, finish: { XCTFail("premature finish") }) } catch {}
        let restarted = PurchaseDelivery(read: { data }, write: write)
        XCTAssertEqual(try restarted.pending(), [purchase])
        _ = try await restarted.deliver(purchase, isCurrent: { true }, mirror: { events.append("mirror"); return try self.response() }, finish: { events.append("finish") })
        XCTAssertEqual(events, ["persist", "mirror", "finish", "persist"])
        XCTAssertTrue(try restarted.pending().isEmpty)
    }

    func testStorageFailureAndOwnerChangeNeverFinish() async throws {
        var mirrored = false, finished = false
        let blocked = PurchaseDelivery(read: { nil }, write: { _ in throw URLError(.cannotWriteToFile) })
        do { _ = try await blocked.deliver(purchase, isCurrent: { true }, mirror: { mirrored = true; return try self.response() }, finish: { finished = true }) } catch {}
        XCTAssertFalse(mirrored); XCTAssertFalse(finished)
        var data: Data?, current = true
        let queue = PurchaseDelivery(read: { data }, write: { data = $0 })
        do { _ = try await queue.deliver(purchase, isCurrent: { current }, mirror: { current = false; return try self.response() }, finish: { finished = true }) } catch { XCTAssertTrue(error is CancellationError) }
        XCTAssertFalse(finished); XCTAssertEqual(try queue.pending(), [purchase])
    }

    func testDuplicateDeliveryMirrorsAndFinishesOnce() async throws {
        var data: Data?, mirrors = 0, finishes = 0
        let queue = PurchaseDelivery(read: { data }, write: { data = $0 })
        let first = Task { try await queue.deliver(purchase, isCurrent: { true }, mirror: {
            mirrors += 1; try await Task.sleep(for: .milliseconds(30)); return try self.response()
        }, finish: { finishes += 1 }) }
        try await Task.sleep(for: .milliseconds(5))
        let duplicate = try await queue.deliver(purchase, isCurrent: { true }, mirror: { mirrors += 1; return try self.response() }, finish: { finishes += 1 })
        XCTAssertFalse(duplicate)
        let delivered = try await first.value
        XCTAssertTrue(delivered); XCTAssertEqual(mirrors, 1); XCTAssertEqual(finishes, 1)
    }
    func testDeliveryOperationIdentitySurvivesPersistence() throws {
        var data: Data?
        let queue = PurchaseDelivery(read: { data }, write: { data = $0 })
        var value = purchase
        value.operationID = UUID()
        try queue.enqueue(value)
        let restored = PurchaseDelivery(read: { data }, write: { data = $0 })
        XCTAssertEqual(try restored.pending().first?.operationID, value.operationID)
    }

}

final class BookReadingPresentationTests: XCTestCase {
    func testOldBooksStillDecodeWithoutEditorialFields() throws {
        let raw = #"{"title":"相談","summary":"相談の要約","answer":"回答。","sections":[],"actions":[]}"#
        let doc = try JSONDecoder().decode(AIBook.Document.self, from: Data(raw.utf8))
        XCTAssertNil(doc.conclusion)
        XCTAssertNil(doc.highlights)
        XCTAssertEqual(doc.answer, "回答。")
    }
    func testOnlyExplicitGenericPrefaceIsHidden() {
        let body = "まず前提として、相手の気持ちを断定することはできません。\n\nまず前提として、仕事を続けたいという相談です。\n\n関係を深める可能性があります。"
        XCTAssertEqual(BookReadingText.paragraphs(body), ["まず前提として、仕事を続けたいという相談です。", "関係を深める可能性があります。"])
    }
    func testEmphasisPreservesEveryCharacter() {
        let text = "相手と話す機会を増やすこと。小さな一歩を試してみましょう。"
        XCTAssertEqual(String(BookReadingText.styled(text, highlights: ["小さな一歩"]).characters), text)
    }
}
