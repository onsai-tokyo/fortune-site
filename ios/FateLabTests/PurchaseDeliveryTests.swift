import XCTest
@testable import FateLab

@MainActor final class PurchaseDeliveryTests: XCTestCase {
    func testReviewCreditsAreSeparateFromMonthlyAndPurchasedCredits() throws {
        let json = #"{"enabled":true,"monthlyCredits":3,"remaining":6,"memberRemaining":3,"purchasedRemaining":0,"reviewRemaining":3,"memberExpiresAt":null,"productId":"test"}"#
        let status = try JSONDecoder().decode(AIBookStatus.self, from: Data(json.utf8))
        XCTAssertEqual(status.reviewRemaining, 3)
        XCTAssertEqual(status.creditBreakdown, "会員分 3通 · 審査用追加分 3通")
    }
    func testBookStatusStillDecodesBeforeServerRollout() throws {
        let json = #"{"enabled":true,"monthlyCredits":3,"remaining":3,"memberRemaining":3,"purchasedRemaining":0,"memberExpiresAt":null,"productId":"test"}"#
        let status = try JSONDecoder().decode(AIBookStatus.self, from: Data(json.utf8))
        XCTAssertNil(status.reviewRemaining)
        XCTAssertEqual(status.creditBreakdown, "会員分 3通")
    }

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
    func testCardApprovalSurvivesRestartAndStaysWithItsOwner() throws {
        var data: Data?
        let a = UUID(), b = UUID()
        let store = CardApprovalStore(read: { data }, write: { data = $0 })
        try store.set(a, pending: true)
        let restarted = CardApprovalStore(read: { data }, write: { data = $0 })
        XCTAssertTrue(try restarted.contains(a))
        XCTAssertFalse(try restarted.contains(b))
        try restarted.set(b, pending: true)
        try restarted.set(a, pending: false)
        XCTAssertFalse(try store.contains(a))
        XCTAssertTrue(try store.contains(b))
    }
    func testUnreadableApprovalStateCannotSilentlyEnableAnotherPurchase() throws {
        let store = CardApprovalStore(read: { Data("invalid".utf8) }, write: { _ in XCTFail("Do not overwrite unreadable state") })
        XCTAssertThrowsError(try store.contains(UUID()))
        XCTAssertThrowsError(try store.set(UUID(), pending: false))
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

    func testReadingAccessResponseIsBackwardsCompatibleAndFailClosed() throws {
        let paused = try JSONDecoder().decode(ReadingAccessResponse.self, from: Data(#"{"enabled":false}"#.utf8))
        XCTAssertFalse(paused.enabled)
        XCTAssertNil(paused.unlocked)
        let legacy = #"{"id":"compat-v24-7","kind":"essence","scope":"couple","title":"復縁の可能性","summary":"本文","tags":[],"pages":[],"evidence":[]}"#
        let card = try JSONDecoder().decode(ReadingCard.self, from: Data(legacy.utf8))
        XCTAssertNil(card.access)
        XCTAssertEqual(card.paidReadingLabel, "復縁の可能性")
        let locked = legacy.dropLast() + #", "access":{"locked":true,"offerKey":"compatibility:compat-v24-7"}}"#
        let projected = try JSONDecoder().decode(ReadingCard.self, from: Data(locked.utf8))
        XCTAssertTrue(projected.showsReadingLock)
    }

    func testReadingPurchaseTargetCannotConfusePairAndYear() throws {
        let target = ReadingPurchaseTarget(conversationId: UUID(), cardId: "turning-year-2027")
        let restored = try JSONDecoder().decode(ReadingPurchaseTarget.self, from: JSONEncoder().encode(target))
        XCTAssertEqual(target, restored)
        XCTAssertNotEqual(target, ReadingPurchaseTarget(conversationId: UUID(), cardId: target.cardId))
    }

    @MainActor func testPurchaseDismissalOpensExactlyOnceAndRejectsChangedAccountOrConversation() throws {
        let raw = #"{"id":"compat-v24-7","kind":"essence","scope":"couple","title":"title","summary":"body","tags":[],"pages":[],"evidence":[],"access":{"locked":false}}"#
        let card = try JSONDecoder().decode(ReadingCard.self, from: Data(raw.utf8))
        let owner = AccountScope(userID: UUID(), epoch: 1)
        let conversation = UUID()
        let navigation = ReadingPurchaseNavigation()
        // The dismissal handler is captured before the asynchronous purchase returns.
        let dismiss = { navigation.consume(owner: owner, conversationID: conversation) }
        XCTAssertNil(dismiss())
        let grant = ReadingAccessGrant(card: card, conversationID: conversation, owner: owner)
        navigation.stage(grant)
        XCTAssertEqual(dismiss()?.card.id, card.id)
        XCTAssertNil(dismiss())
        navigation.stage(grant)
        XCTAssertNil(navigation.consume(owner: .init(userID: owner.userID, epoch: 2), conversationID: conversation))
        XCTAssertNil(dismiss())
        navigation.stage(grant)
        XCTAssertNil(navigation.consume(owner: owner, conversationID: UUID()))
        navigation.stage(grant)
        navigation.clear()
        XCTAssertNil(dismiss())
    }

    func testFreshReadingHandoffRejectsOtherAccountsTargetsAndExpiredResults() throws {
        let raw = #"{"id":"compat-v24-7","kind":"essence","scope":"couple","title":"title","summary":"body","tags":[],"pages":[],"evidence":[],"access":{"locked":false}}"#
        var card = try JSONDecoder().decode(ReadingCard.self, from: Data(raw.utf8))
        let owner = AccountScope(userID: UUID(), epoch: 1)
        let conversation = UUID()
        let now = Date()
        let grant = ReadingAccessGrant(card: card, conversationID: conversation, owner: owner, checkedAt: now)
        XCTAssertTrue(grant.matches(cardID: card.id, conversationID: conversation, owner: owner, now: now))
        XCTAssertFalse(grant.matches(cardID: "other", conversationID: conversation, owner: owner, now: now))
        XCTAssertFalse(grant.matches(cardID: card.id, conversationID: UUID(), owner: owner, now: now))
        XCTAssertFalse(grant.matches(cardID: card.id, conversationID: conversation, owner: .init(userID: owner.userID, epoch: 2), now: now))
        XCTAssertFalse(grant.matches(cardID: card.id, conversationID: conversation, owner: .init(userID: UUID(), epoch: 1), now: now))
        XCTAssertFalse(grant.matches(cardID: card.id, conversationID: conversation, owner: owner, now: now.addingTimeInterval(30)))
        card.access = nil
        XCTAssertFalse(ReadingAccessGrant(card: card, conversationID: conversation, owner: owner).matches(cardID: card.id, conversationID: conversation, owner: owner))
    }
}

@MainActor
final class BookMembershipContinuationTests: XCTestCase {
    private let owner = AccountScope(userID: UUID(), epoch: 1)
    private func draft() -> PendingAIBook { PendingAIBook(operationID: UUID(), sourceID: UUID(), theme: "仕事", question: "入力済みの相談内容を保持して購入後に一度だけ作成する") }

    func testPurchaseSuccessResumesTheExactDraftOnlyOnce() {
        let continuation = BookMembershipContinuation(), value = draft()
        continuation.prepare(value, owner: owner)
        XCTAssertTrue(continuation.authorize(owner: owner, premium: true, remaining: 3))
        XCTAssertTrue(continuation.authorize(owner: owner, premium: true, remaining: 3))
        let resumed = continuation.consume(owner: owner)
        XCTAssertEqual(resumed?.operationID, value.operationID)
        XCTAssertEqual(resumed?.question, value.question)
        XCTAssertEqual(resumed?.sourceID, value.sourceID)
        XCTAssertNil(continuation.consume(owner: owner))
    }
    func testCancellationCreditsWithoutMembershipAndEmptyBalanceNeverResume() {
        for (premium, remaining) in [(false, 3), (true, 0)] {
            let continuation = BookMembershipContinuation()
            continuation.prepare(draft(), owner: owner)
            XCTAssertFalse(continuation.authorize(owner: owner, premium: premium, remaining: remaining))
            XCTAssertNil(continuation.consume(owner: owner))
        }
        let continuation = BookMembershipContinuation()
        continuation.prepare(draft(), owner: owner)
        XCTAssertNil(continuation.consume(owner: owner))
    }
    func testAccountChangeCannotResumeAnotherAccountsDraft() {
        let continuation = BookMembershipContinuation()
        continuation.prepare(draft(), owner: owner)
        let changed = AccountScope(userID: owner.userID, epoch: owner.epoch + 1)
        XCTAssertFalse(continuation.authorize(owner: changed, premium: true, remaining: 3))
        XCTAssertTrue(continuation.authorize(owner: owner, premium: true, remaining: 3))
        XCTAssertNil(continuation.consume(owner: changed))
        XCTAssertNil(continuation.consume(owner: owner))
    }
}

@MainActor final class MembershipPurchaseFlowTests: XCTestCase {
    func testExpiredRenewalsLeadToCheckoutInSameAction() async throws {
        var calls = 0
        let results: [MembershipPurchaseFlow.Attempt] = [.historical("oct2"), .historical("oct1"), .historical("sep30"), .delivered]
        let result = try await MembershipPurchaseFlow.run {
            defer { calls += 1 }
            return results[calls]
        }
        XCTAssertEqual(result, .delivered)
        XCTAssertEqual(calls, 4)
    }

    func testCurrentCancelledAndPendingNeverPurchaseAgain() async throws {
        for terminal: MembershipPurchaseFlow.Attempt in [.delivered, .cancelled, .pending] {
            var calls = 0
            let result = try await MembershipPurchaseFlow.run { calls += 1; return terminal }
            XCTAssertEqual(result, terminal)
            XCTAssertEqual(calls, 1)
        }
    }

    func testDeliveryFailureNeverRetriesCheckout() async {
        var calls = 0
        do {
            _ = try await MembershipPurchaseFlow.run {
                calls += 1
                throw URLError(.notConnectedToInternet)
            }
            XCTFail("Expected delivery failure")
        } catch { XCTAssertEqual(calls, 1) }
    }

    func testRepeatedHistoricalTransactionStops() async {
        var calls = 0
        do {
            _ = try await MembershipPurchaseFlow.run { calls += 1; return .historical("same") }
            XCTFail("Expected duplicate protection")
        } catch { XCTAssertEqual(calls, 2) }
    }

    func testBacklogHasBoundedAttempts() async {
        var calls = 0
        do {
            _ = try await MembershipPurchaseFlow.run { calls += 1; return .historical(String(calls)) }
            XCTFail("Expected backlog limit")
        } catch { XCTAssertEqual(calls, 32) }
    }

    func testOnlyTransactionsExpiredBeforeUserActionAreHistorical() {
        let start = Date(timeIntervalSince1970: 1000)
        XCTAssertTrue(MembershipPurchaseFlow.isHistorical(expiration: start.addingTimeInterval(-1), revoked: false, upgraded: false, startedAt: start))
        // A new purchase expiring while the server responds must never trigger a second charge.
        XCTAssertFalse(MembershipPurchaseFlow.isHistorical(expiration: start.addingTimeInterval(1), revoked: false, upgraded: false, startedAt: start))
        XCTAssertFalse(MembershipPurchaseFlow.isHistorical(expiration: nil, revoked: false, upgraded: false, startedAt: start))
        XCTAssertFalse(MembershipPurchaseFlow.isHistorical(expiration: start, revoked: true, upgraded: false, startedAt: start))
        XCTAssertFalse(MembershipPurchaseFlow.isHistorical(expiration: start, revoked: false, upgraded: true, startedAt: start))
    }

    func testAccountCancellationStopsBeforeNextCheckout() async {
        var calls = 0
        do {
            _ = try await MembershipPurchaseFlow.run { calls += 1; throw CancellationError() }
            XCTFail("Expected cancellation")
        } catch { XCTAssertEqual(calls, 1) }
    }
}
