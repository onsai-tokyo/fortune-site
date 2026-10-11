import SwiftUI

enum AISharingConsent {
    static let version = "anthropic-inline-2026-10-11-v3"
    static let actionTitle = "同意して鑑定する"
    static var termsURL: URL {
        var url = URLComponents(url: AppConfig.websiteBaseURL.appendingPathComponent("terms"), resolvingAgainstBaseURL: false)!
        url.fragment = "ai-consultation"
        return url.url!
    }
}

struct AISharingNoticeView: View {
    var includesConversationHistory = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(includesConversationHistory
                ? "質問・履歴・鑑定内容・出生情報をAnthropicと共有して回答を作成します。"
                : "相談文・鑑定内容・命式をAnthropicと共有して鑑定書を作成します。")
            Text(.init("[利用規約](\(AISharingConsent.termsURL.absoluteString))をご確認のうえ、お進みください。"))
        }
        .font(.caption).foregroundStyle(FateTheme.muted).tint(FateTheme.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("aiConsent.termsNotice")
        .inAppLegalLinks()
    }
}
