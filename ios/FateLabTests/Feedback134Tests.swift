import XCTest
@testable import FateLab

final class Feedback134Tests: XCTestCase {
    func testDeletedReadingRestartsOnboardingWithoutTouchingPurchasesOrAnotherAccount() {
        let suite = "reset-tests-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let user = UUID(), other = UUID()
        defaults.set(user.uuidString, forKey: AccountStorage.key("onboarding.completedUserID", userID: user))
        defaults.set(Data("old birth".utf8), forKey: AccountStorage.key("birth.profile", userID: user))
        defaults.set("purchase", forKey: AccountStorage.key("purchase", userID: user))
        defaults.set("other", forKey: AccountStorage.key("birth.profile", userID: other))
        XCTAssertTrue(AccountStorage.resetCompletedOnboardingIfNeeded(userID: user, hasPendingReading: false, defaults: defaults))
        XCTAssertNil(defaults.object(forKey: AccountStorage.key("birth.profile", userID: user)))
        XCTAssertNil(defaults.object(forKey: AccountStorage.key("onboarding.completedUserID", userID: user)))
        XCTAssertEqual(defaults.string(forKey: AccountStorage.key("purchase", userID: user)), "purchase")
        XCTAssertEqual(defaults.string(forKey: AccountStorage.key("birth.profile", userID: other)), "other")
    }
    func testUnfinishedInitialReadingAndOnboardingDraftArePreserved() {
        let suite = "draft-tests-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let user = UUID(), key = AccountStorage.key("onboarding.completedUserID", userID: user)
        defaults.set(user.uuidString, forKey: key)
        XCTAssertFalse(AccountStorage.resetCompletedOnboardingIfNeeded(userID: user, hasPendingReading: true, defaults: defaults))
        defaults.set("unfinished", forKey: AccountStorage.key("onboarding.draft", userID: user))
        XCTAssertFalse(AccountStorage.resetCompletedOnboardingIfNeeded(userID: user, hasPendingReading: false, defaults: defaults))
        XCTAssertEqual(defaults.string(forKey: key), user.uuidString)
    }
    @MainActor func testConsentWaitsForExplicitAcceptanceThenResumesOnce() {
        let suite = "consent-tests-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let gate = AIConsentGate(defaults: defaults)
        let owner = AccountScope(userID: UUID(), epoch: 1)
        var sends = 0
        gate.request(owner: owner) { sends += 1 }
        XCTAssertTrue(gate.isPresented)
        XCTAssertEqual(sends, 0)
        gate.didDismiss(owner: owner) // interactive dismissal is not consent
        XCTAssertFalse(AISharingConsent.isAccepted(userID: owner.userID, defaults: defaults))
        XCTAssertEqual(sends, 0)
        gate.request(owner: owner) { sends += 1 }
        gate.agree(owner: owner)
        XCTAssertEqual(sends, 0) // wait for sheet dismissal before generation/paywall
        gate.didDismiss(owner: owner)
        gate.didDismiss(owner: owner)
        XCTAssertEqual(sends, 1)
        gate.request(owner: owner) { sends += 1 }
        XCTAssertFalse(gate.isPresented)
        XCTAssertEqual(sends, 2)
        XCTAssertFalse(AISharingConsent.isAccepted(userID: UUID(), defaults: defaults))
        XCTAssertFalse(AISharingConsent.isAccepted(userID: nil, defaults: defaults))
    }
    @MainActor func testAccountChangeAndOldRevisionCannotAuthorizeSending() {
        let suite = "consent-tests-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let user = UUID(), gate = AIConsentGate(defaults: defaults)
        let owner = AccountScope(userID: user, epoch: 1)
        defaults.set("old-version", forKey: AccountStorage.key("ai.sharing.consent", userID: user))
        var sends = 0
        gate.request(owner: owner) { sends += 1 }
        XCTAssertTrue(gate.isPresented)
        gate.agree(owner: AccountScope(userID: user, epoch: 2))
        gate.didDismiss(owner: owner)
        XCTAssertEqual(sends, 0)
        XCTAssertFalse(AISharingConsent.isAccepted(userID: user, defaults: defaults))
        gate.request(owner: owner) { sends += 1 }
        gate.cancel()
        gate.didDismiss(owner: owner)
        XCTAssertEqual(sends, 0)
    }
}
