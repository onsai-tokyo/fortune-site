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
    @State private var loadedID: UUID?

    var body: some View {
        ScrollView {
            Group {
                if isLoading {
                    VStack(spacing: 8) {
                        FateLoadingView(title: "鑑定書を開いています", detail: elapsed < 8 ? "保存したあなたの物語を、手元に。" : "接続に少し時間がかかっています。")
                        if elapsed >= 8 {
                            Button("もう一度読み込む") { Task { await load() } }
                                .buttonStyle(FLSecondaryButtonStyle()).frame(maxWidth: 260)
                        }
                    }.frame(maxWidth: .infinity, minHeight: 480)
                } else if let detail {
                    let isCompatibility = (detail.conversation.kind ?? readingKind) == "compatibility"
                    let report = GeneratedReport(
                        birthData: [:],
                        calculatedData: [:],
                        text: detail.conversation.reportText,
                        cards: cards,
                        chartSections: chartSections, conversationID: conversationID
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
        .task(id: conversationID) { if loadedID != conversationID { await load() } }
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
        let owner = AccountScope(auth)
        isLoading = loadedID != conversationID
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let detailRequest = APIClient.shared.conversation(id: conversationID, auth: auth)
            async let cardsRequest = APIClient.shared.cards(id: conversationID, auth: auth)
            let nextDetail = try await detailRequest
            let report = try await cardsRequest
            try owner.check(auth)
            guard !Task.isCancelled else { return }
            detail = nextDetail
            loadedID = conversationID
            cards = report.cards
            chartSections = report.chartSections ?? []
        } catch {
            errorMessage = userFacingMessage(error)
            errorKind = errorStateKind(error)
        }
    }
}
