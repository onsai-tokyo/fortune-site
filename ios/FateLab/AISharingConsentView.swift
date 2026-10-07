import SwiftUI

enum AISharingConsent {
    static let version = "terms-ai-2026-10-07-v2"
    static var termsURL: URL {
        var url = URLComponents(url: AppConfig.websiteBaseURL.appendingPathComponent("terms"), resolvingAgainstBaseURL: false)!
        url.fragment = "ai-consultation"
        return url.url!
    }
}

struct AISharingNoticeView: View {
    var body: some View {
        Text(.init("[利用規約](\(AISharingConsent.termsURL.absoluteString))に同意した上での鑑定をお願いします。"))
            .font(.caption).foregroundStyle(FateTheme.muted).tint(FateTheme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("aiConsent.termsNotice")
    }
}
