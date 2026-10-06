import SwiftUI

enum AISharingConsent {
    static let version = "anthropic-2026-10-07-v1"
}

struct AISharingConsentView: View {
    let isBook: Bool
    let onAgree: () -> Void
    let onCancel: () -> Void
    @State private var agreed = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("AIへの情報送信について").font(FateType.screenTitle)
                    Text(isBook ? "相談に沿った鑑定書を作成するため、次の情報を外部AIへ送信します。" : "質問への回答を作成するため、次の情報を外部AIへ送信します。")
                    VStack(alignment: .leading, spacing: 10) {
                        Text("送信先").font(.headline)
                        Text("Anthropic PBC（Claude API）")
                        Text("送信する情報").font(.headline).padding(.top, 8)
                        Text(isBook ? "相談文、選択したテーマ、もとにする鑑定文と判定の根拠・計算結果。" : "質問文、最近の会話履歴、もとの鑑定文・計算結果、保存した出生情報（生年月日・出生時刻・出生地・性別・ニックネームなど）。")
                        Text("ふたりの相談では、相手に関する情報も含まれます。相談文に入力した個人情報も送信されます。共有してよい情報だけを入力してください。")
                    }.padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
                    Link("プライバシーポリシーを確認する", destination: AppConfig.websiteBaseURL.appendingPathComponent("privacy"))
                    Text("同意は今回の送信に限ります。同意しなくても、保存済みの鑑定を読むことはできます。").font(.footnote).foregroundStyle(FateTheme.muted)
                    Toggle("上記の情報をAnthropicへ送信することに同意します", isOn: $agreed)
                        .accessibilityIdentifier("aiConsent.agree")
                    Button("同意して送信する", action: onAgree)
                        .buttonStyle(FLPrimaryButtonStyle()).disabled(!agreed)
                        .accessibilityIdentifier("aiConsent.send")
                    Button("送信せず戻る", action: onCancel).buttonStyle(FLSecondaryButtonStyle())
                }.padding(24)
            }.background(FateTheme.canvas)
        }
    }
}
