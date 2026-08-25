import SwiftUI

struct SavedReadingView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    let conversationID: UUID
    var readingKind: String? = nil

    @State private var detail: ConversationDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch
    @State private var cards: [ReadingCard] = []
    @State private var chartSections: [ChartSection] = []
    @State private var elapsed = 0

    var body: some View {
        ScrollView {
            Group {
                if isLoading {
                    VStack(spacing: 16) {
                        ProgressView().tint(FateTheme.ink)
                        Text("鑑定書を開いています")
                            .font(.system(size: 18, weight: .medium))
                        Text(elapsed < 3 ? "保存した内容を読み込んでいます。"
                             : elapsed < 8 ? "内容を整えています。もう少しお待ちください。"
                             : "通信に時間がかかっています。")
                            .font(.caption)
                            .foregroundStyle(FateTheme.muted)
                        if elapsed >= 8 {
                            Button("もう一度読み込む") { Task { await load() } }
                                .buttonStyle(FLSecondaryButtonStyle())
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 520)
                } else if let detail {
                    let isCompatibility = (detail.conversation.kind ?? readingKind) == "compatibility"
                    let report = GeneratedReport(
                        birthData: [:],
                        calculatedData: [:],
                        text: detail.conversation.reportText,
                        cards: cards,
                        chartSections: chartSections
                    )
                    VStack(alignment: .leading, spacing: 18) {
                        InsightHubView(report: report, scope: isCompatibility ? .couple : .self, onQuestion: { card in
                            tabRouter.openChat(conversationID: conversationID, contextTitle: card.title)
                        }, onReload: { Task { await load() } })

                        Button("この鑑定書について質問する") {
                            tabRouter.openChat(conversationID: conversationID)
                        }
                            .buttonStyle(FLPrimaryButtonStyle())

                    }
                } else {
                    FLErrorState(kind: errorKind) {
                        Task { await load() }
                    }.frame(minHeight: 520)
                }
            }
            .padding(FateSpacing.screenH)
        }
        .background(FateTheme.canvas)
        .fateScreenTitle(detail?.conversation.title ?? (readingKind == "compatibility" ? "二人の関係鑑定" : "あなたの鑑定"))
        .task { await load() }
        .task(id: isLoading) {
            guard isLoading else { return }
            elapsed = 0
            while isLoading && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                elapsed += 1
            }
        }
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
            errorKind = errorStateKind(error)
        }
    }
}
