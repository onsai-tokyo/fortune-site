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
    @State private var agreed = false
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text("はじめに、利用条件をご確認ください。")
                    .font(.subheadline).foregroundStyle(FateTheme.muted)
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("AI鑑定・相談に関する利用条件").font(.headline)
                        Text("相談に合わせた鑑定書や回答を作成するため、Anthropic PBC（Claude API）へ以下の情報を送信します。")
                        disclosure("鑑定書をつくる", "相談文、テーマ、もとにする鑑定文、命式・計算結果")
                        disclosure("鑑定結果への質問", "質問文、最近の会話履歴、鑑定文・計算結果、保存した出生情報（生年月日・出生時刻・出生地・性別・ニックネームなど）")
                        Text("ふたりの相談には相手の情報も含まれます。共有してよい情報だけを入力してください。")
                        Text("同意はこのアカウントでの以後のAI鑑定・質問にも適用されます。送信は鑑定・質問の操作時のみ行います。同意しなくても保存済みの鑑定は読めます。")
                        LegalLink("利用規約の全文を読む", destination: AISharingConsent.termsURL)
                    }.font(.subheadline).lineSpacing(5).padding(18)
                }
                .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line, lineWidth: 1))
                Button { agreed.toggle() } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: agreed ? "checkmark.square.fill" : "square").font(.title3)
                        Text("利用規約と上記の情報送信に同意する").font(.subheadline)
                    }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                }.buttonStyle(.plain)
                    .accessibilityIdentifier("aiConsent.checkbox")
                    .accessibilityValue(agreed ? "チェック済み" : "未チェック")
                Button("同意して続ける") { guard agreed else { return }; onAgree() }
                    .buttonStyle(FLPrimaryButtonStyle()).disabled(!agreed)
                    .accessibilityIdentifier("aiConsent.agree")
            }.padding(24).background(FateTheme.canvas).foregroundStyle(FateTheme.ink)
                .navigationTitle("利用規約の確認").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる", action: onCancel) } }
        }.tint(FateTheme.ink).presentationDetents([.height(620), .large]).presentationDragIndicator(.visible)
    }

    private func disclosure(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(FateTheme.muted)
            Text(text)
        }
    }
}
