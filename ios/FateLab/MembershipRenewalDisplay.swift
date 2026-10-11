import Foundation

struct MembershipRenewalDisplay {
    let willAutoRenew: Bool
    let expiresAt: Date

    func cancellationNotice(isPremium: Bool, now: Date = Date()) -> String? {
        guard isPremium, !willAutoRenew, expiresAt > now else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.dateFormat = "M月d日 HH:mm"
        return "解約済み・\(formatter.string(from: expiresAt))まで利用可能"
    }
}
