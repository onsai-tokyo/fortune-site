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
    @State private var loadedOwner: AccountScope?
    private struct LoadIdentity: Hashable { let conversationID: UUID; let owner: AccountScope }

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
                            tabRouter.openBook(conversationID: conversationID, card: card)
                        }, onReload: { Task { await load() } })

                        Button("この鑑定書について質問する") {
                            tabRouter.openBook(conversationID: conversationID)
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
        .task(id: LoadIdentity(conversationID: conversationID, owner: AccountScope(auth))) { if loadedID != conversationID || loadedOwner != AccountScope(auth) { await load() } }
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
            detail = nil; cards = []; chartSections = []; loadedID = nil; loadedOwner = nil
            isLoading = false
            errorMessage = "ログイン情報を確認できませんでした。"
            return
        }
        let owner = AccountScope(auth)
        if loadedOwner != owner || loadedID != conversationID {
            detail = nil; cards = []; chartSections = []; loadedID = nil
        }
        if let cached = SavedReadingMemoryCache.shared.value(id: conversationID, owner: owner) {
            detail = cached.detail; cards = cached.report.cards
            chartSections = cached.report.chartSections ?? []
            loadedID = conversationID; loadedOwner = owner
        }
        isLoading = detail == nil
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
            loadedID = conversationID; loadedOwner = owner
            SavedReadingMemoryCache.shared.store(.init(detail: nextDetail, report: report), id: conversationID, owner: owner)
            cards = report.cards
            chartSections = report.chartSections ?? []
        } catch is CancellationError { }
        catch {
            guard owner.isCurrent(auth) else { return }
            if case APIError.http(status: 404, message: _) = error {
                SavedReadingMemoryCache.shared.remove(id: conversationID, owner: owner)
                detail = nil; cards = []; chartSections = []; loadedID = nil
            }
            errorMessage = userFacingMessage(error)
            errorKind = errorStateKind(error)
        }
    }
}


/// Keeps only the current login session's recently opened readings in memory.
/// Restoring a snapshot never skips the background server refresh.
@MainActor
final class SavedReadingMemoryCache {
    static let shared = SavedReadingMemoryCache()
    struct Snapshot {
        let detail: ConversationDetail
        let report: StructuredReportResponse
    }
    private var owner: AccountScope?
    private var values: [UUID: Snapshot] = [:]
    private var order: [UUID] = []
    private func select(_ requested: AccountScope) {
        if owner != requested { values.removeAll(); order.removeAll(); owner = requested }
    }
    func value(id: UUID, owner: AccountScope) -> Snapshot? {
        select(owner)
        guard owner.userID != nil else { return nil }
        return values[id]
    }
    func store(_ value: Snapshot, id: UUID, owner: AccountScope) {
        select(owner)
        guard owner.userID != nil else { return }
        values[id] = value; order.removeAll { $0 == id }; order.append(id)
        while order.count > 12 { values.removeValue(forKey: order.removeFirst()) }
    }
    func remove(id: UUID, owner: AccountScope) {
        select(owner); values.removeValue(forKey: id); order.removeAll { $0 == id }
    }
    func seed(_ report: GeneratedReport, id: UUID, owner: AccountScope) {
        seedResponse(.init(version: 3, reportText: report.text, cards: report.cards,
            chartSections: report.chartSections, conversationID: id), id: id, owner: owner)
    }
    func seedResponse(_ report: StructuredReportResponse, id: UUID, owner: AccountScope) {
        let couple = report.cards.contains { $0.scope == "couple" }
        let detail = value(id: id, owner: owner)?.detail ?? ConversationDetail(conversation: ConversationRecord(id: id,
            title: couple ? "二人の関係鑑定" : "あなたの鑑定", reportText: report.reportText, isSaved: true,
            kind: couple ? "compatibility" : "self"), messages: [])
        store(.init(detail: detail, report: report), id: id, owner: owner)
    }
}
