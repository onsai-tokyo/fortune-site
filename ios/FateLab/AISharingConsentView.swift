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
        VStack(alignment: .leading, spacing: 4) {
            Text(includesConversationHistory
                ? "回答の作成のため、質問・会話履歴・鑑定内容・出生情報をAnthropic（Claude）へ送信します。"
                : "鑑定書の作成のため、相談文・選んだ鑑定内容・命式などの情報をAnthropic（Claude）へ送信します。")
            Text(.init("[利用規約・AIへの送信について](\(AISharingConsent.termsURL.absoluteString))をご確認のうえ、同意してお進みください。"))
        }
        .font(.caption).foregroundStyle(FateTheme.muted).tint(FateTheme.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("aiConsent.termsNotice")
    }
}
