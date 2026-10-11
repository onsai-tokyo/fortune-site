import XCTest
@testable import FateLab

final class MembershipRenewalDisplayTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testTransferredMembershipRequiresExactServerLineage() throws {
        let data = Data(#"{"originalTransactionId":"123","productId":"annual","environment":"Sandbox"}"#.utf8)
        let value = try JSONDecoder().decode(AppleMembershipDisplay.self, from: data)
        XCTAssertTrue(value.matches(originalID: "123", productID: "annual", environment: "Sandbox"))
        XCTAssertFalse(value.matches(originalID: "other", productID: "annual", environment: "Sandbox"))
        XCTAssertFalse(value.matches(originalID: "123", productID: "monthly", environment: "Sandbox"))
        XCTAssertFalse(value.matches(originalID: "123", productID: "annual", environment: "Production"))
    }

    func testCancelledButUnexpiredShowsAccessUntilExpiry() {
        let value = MembershipRenewalDisplay(willAutoRenew: false, expiresAt: now.addingTimeInterval(3600))
        XCTAssertTrue(value.cancellationNotice(isPremium: true, now: now)?.hasPrefix("解約済み・") == true)
        XCTAssertTrue(value.cancellationNotice(isPremium: true, now: now)?.hasSuffix("まで利用可能") == true)
    }
    func testRenewingMemberNeverLooksCancelled() {
        XCTAssertNil(MembershipRenewalDisplay(willAutoRenew: true, expiresAt: now.addingTimeInterval(3600)).cancellationNotice(isPremium: true, now: now))
    }
    func testExpiredAndStandardAccessNeverPromiseMembership() {
        for seconds in [-1.0, 0] {
            XCTAssertNil(MembershipRenewalDisplay(willAutoRenew: false, expiresAt: now.addingTimeInterval(seconds)).cancellationNotice(isPremium: true, now: now))
        }
        XCTAssertNil(MembershipRenewalDisplay(willAutoRenew: false, expiresAt: now.addingTimeInterval(3600)).cancellationNotice(isPremium: false, now: now))
    }
}
