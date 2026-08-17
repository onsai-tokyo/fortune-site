import SwiftUI

struct SavedReadingView: View {
    @EnvironmentObject private var auth: AuthStore
    let conversationID: UUID

    @State private var detail: ConversationDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var openQuestions = false

    var body: some View {
        ScrollView {
            Group {
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView().tint(FateTheme.gold)
                        Text("鑑定書を開いています")
                            .font(.system(size: 18, weight: .medium, design: .serif))
                        Text("保存した内容を読み込んでいます。")
                            .font(.caption)
                            .foregroundStyle(FateTheme.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 520)
                } else if let detail {
                    let report = GeneratedReport(
                        birthData: [:],
                        calculatedData: [:],
                        text: detail.conversation.reportText
                    )
                    VStack(alignment: .leading, spacing: 18) {
                        InsightHubView(report: report) { openQuestions = true }

                        Button("この鑑定書について質問する") { openQuestions = true }
                            .buttonStyle(GoldButtonStyle())

                        DisclosureGroup("鑑定書の全文を読む") {
                            Text(detail.conversation.reportText)
                                .font(.system(size: 15))
                                .lineSpacing(8)
                                .padding(.top, 14)
                        }
                        .font(.system(size: 16, weight: .medium, design: .serif))
                        .foregroundStyle(FateTheme.ink)
                        .padding(.vertical, 14)
                    }
                } else {
                    ContentUnavailableView(
                        "鑑定書を開けませんでした",
                        systemImage: "doc.text.magnifyingglass",
                        description: Text(errorMessage ?? "少し待ってから、もう一度お試しください。")
                    )
                    .frame(minHeight: 520)
                }
            }
            .padding(20)
        }
        .background(FateTheme.ivory)
        .fateScreenTitle(detail?.conversation.title ?? "あなたの鑑定")
        .navigationDestination(isPresented: $openQuestions) {
            ReadingChatView(conversationID: conversationID)
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard let token = auth.session?.accessToken else {
            isLoading = false
            errorMessage = "ログイン情報を確認できませんでした。"
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            detail = try await APIClient.shared.conversation(id: conversationID, token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
