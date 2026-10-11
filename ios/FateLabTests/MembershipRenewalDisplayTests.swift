import XCTest
@testable import FateLab

final class MembershipRenewalDisplayTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

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
