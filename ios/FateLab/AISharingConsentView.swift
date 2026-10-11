import SwiftUI

// The server already accepts this disclosure's scope. The local acknowledgement
// uses a separate revision so previous inline consent cannot silently opt in.
enum AISharingConsent {
    static let version = "anthropic-inline-2026-10-11-v3"
    static let acknowledgementRevision = "first-use-2026-10-12-v1"
    static let actionTitle = "鑑定する"
    static var termsURL: URL {
        var url = URLComponents(url: AppConfig.websiteBaseURL.appendingPathComponent("terms"), resolvingAgainstBaseURL: false)!
        url.fragment = "ai-consultation"
        return url.url!
    }
    static func isAccepted(userID: UUID?, defaults: UserDefaults = .standard) -> Bool {
        guard let userID else { return false }
        return defaults.string(forKey: AccountStorage.key("ai.sharing.consent", userID: userID)) == acknowledgementRevision
    }
    static func accept(userID: UUID, defaults: UserDefaults = .standard) {
        defaults.set(acknowledgementRevision, forKey: AccountStorage.key("ai.sharing.consent", userID: userID))
    }
}

struct AISharingNoticeView: View {
    var includesConversationHistory = false
    var body: some View {
        Text(.init("[利用規約](\(AISharingConsent.termsURL.absoluteString))に同意のうえ、鑑定をお願いします。"))
            .font(.caption).foregroundStyle(FateTheme.muted).tint(FateTheme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("aiConsent.termsNotice")
            .inAppLegalLinks()
    }
}

@MainActor final class AIConsentGate: ObservableObject {
    @Published var isPresented = false
    private var owner: AccountScope?
    private var continuation: (() -> Void)?
    private var accepted = false
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) { self.defaults = defaults }
    func request(auth: AuthStore, action: @escaping () -> Void) { request(owner: AccountScope(auth), action: action) }
    func agree(auth: AuthStore) { agree(owner: AccountScope(auth)) }
    func didDismiss(auth: AuthStore) { didDismiss(owner: AccountScope(auth)) }
    func request(owner: AccountScope, action: @escaping () -> Void) {
        guard owner.userID != nil else { return }
        if AISharingConsent.isAccepted(userID: owner.userID, defaults: defaults) { action(); return }
        self.owner = owner; continuation = action; accepted = false; isPresented = true
    }
    func agree(owner current: AccountScope) {
        guard let owner, owner == current, let id = owner.userID else { cancel(); return }
        AISharingConsent.accept(userID: id, defaults: defaults)
        accepted = true; isPresented = false
    }
    func didDismiss(owner current: AccountScope) {
        let action = accepted && owner == current ? continuation : nil
        cancel()
        action?()
    }

    func cancel() { isPresented = false; accepted = false; owner = nil; continuation = nil }
}

struct AIConsentSheet: View {
    let onAgree: () -> Void
    let onCancel: () -> Void
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("鑑定をはじめる前に").font(.system(.title2, weight: .medium))
                    Text("AI鑑定・相談に関する利用条件").font(.headline)
                    Text("相談に合わせた鑑定書や回答を作成するため、Anthropic PBC（Claude API）へ以下の情報を送信します。")
                    VStack(alignment: .leading, spacing: 18) {
                        disclosure("鑑定書をつくる", "相談文、テーマ、もとにする鑑定文、命式・計算結果")
                        disclosure("鑑定結果への質問", "質問文、最近の会話履歴、鑑定文・計算結果、保存した出生情報（生年月日・出生時刻・出生地・性別・ニックネームなど）")
                    }.padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 18))
                    Text("ふたりの相談には相手の情報も含まれます。共有してよい情報だけを入力してください。")
                    Text("同意はこのアカウントでの以後のAI鑑定・質問にも適用されます。送信は鑑定・質問の操作時のみ行います。同意しなくても保存済みの鑑定は読めます。")
                    LegalLink("利用規約を詳しく読む", destination: AISharingConsent.termsURL)
                    Button("同意して続ける", action: onAgree).buttonStyle(FLPrimaryButtonStyle())
                        .accessibilityIdentifier("aiConsent.agree")
                    Button("今は同意しない", action: onCancel).frame(maxWidth: .infinity, minHeight: 44)
                }.font(.subheadline).lineSpacing(6).padding(24)
            }.background(FateTheme.canvas).foregroundStyle(FateTheme.ink)
                .navigationTitle("AI利用条件").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる", action: onCancel) } }
        }.tint(FateTheme.ink).presentationDetents([.large])
    }
    private func disclosure(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(FateTheme.muted)
            Text(text)
        }
    }
}
