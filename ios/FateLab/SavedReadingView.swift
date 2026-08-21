import SwiftUI

struct SavedReadingView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    let conversationID: UUID

    @State private var detail: ConversationDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var cards: [ReadingCard] = []
    @State private var chartSections: [ChartSection] = []

    var body: some View {
        ScrollView {
            Group {
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView().tint(FateTheme.ink)
                        Text("鑑定書を開いています")
                            .font(.system(size: 18, weight: .medium))
                        Text("保存した内容を読み込んでいます。")
                            .font(.caption)
                            .foregroundStyle(FateTheme.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 520)
                } else if let detail {
                    let report = GeneratedReport(
                        birthData: [:],
                        calculatedData: [:],
                        text: detail.conversation.reportText,
                        cards: cards,
                        chartSections: chartSections
                    )
                    VStack(alignment: .leading, spacing: 18) {
                        InsightHubView(report: report, onQuestion: { card in
                            tabRouter.openChat(conversationID: conversationID, contextTitle: card.title)
                        }, onReload: { Task { await load() } })

                        Button("この鑑定書について質問する") {
                            tabRouter.openChat(conversationID: conversationID)
                        }
                            .buttonStyle(FLPrimaryButtonStyle())

                    }
                } else {
                    FLErrorState(title: "鑑定書を開けませんでした", message: errorMessage ?? "少し待ってから、もう一度お試しください。") {
                        Task { await load() }
                    }.frame(minHeight: 520)
                }
            }
            .padding(FateSpacing.screenH)
        }
        .background(FateTheme.canvas)
        .fateScreenTitle(detail?.conversation.title ?? "あなたの鑑定")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard auth.session != nil else {
            isLoading = false
            errorMessage = "ログイン情報を確認できませんでした。"
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let detailRequest = APIClient.shared.conversation(id: conversationID, auth: auth)
            async let cardsRequest = APIClient.shared.cards(id: conversationID, auth: auth)
            detail = try await detailRequest
            let report = try await cardsRequest
            cards = report.cards
            chartSections = report.chartSections ?? []
        } catch {
            errorMessage = userFacingMessage(error)
        }
    }
}
