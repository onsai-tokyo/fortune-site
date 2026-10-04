import SwiftUI

struct ReadingListView: View {
    var onNewReading: () -> Void = {}
    var chatsOnly = false
    @EnvironmentObject private var auth: AuthStore
    @State private var readings: [ReadingSummary] = []
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch
    @State private var isLoading = false

    var body: some View {
        Group {
            if !chatsOnly {
                BookshelfView(onNewReading: onNewReading)
            } else if auth.session != nil {
                List {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(chatsOnly ? "対話の記録" : "あなたの本棚").font(FateType.screenTitle)
                        Text(chatsOnly ? "読み解いてきた言葉を、もう一度。" : "自分を知る言葉を、いつでもここから。")
                            .font(.subheadline).foregroundStyle(FateTheme.muted)
                    }.padding(.vertical, 16).listRowBackground(FateTheme.canvas).listRowSeparator(.hidden)
                    if isLoading { FateInlineLoading(title: "読み込んでいます").frame(maxWidth: .infinity).listRowBackground(FateTheme.canvas) }
                    if errorMessage != nil {
                        FLErrorState(kind: errorKind) { Task { await load() } }
                            .listRowBackground(FateTheme.canvas)
                    }
                    if visibleReadings.isEmpty {
                        VStack(spacing: 16) {
                            FLEmptyState(title: chatsOnly ? "まだ対話がありません" : "まだ鑑定がありません",
                                         message: chatsOnly ? "鑑定書で気になる項目を開き、質問するとここに保存されます。" : "生まれたときの情報から、最初の鑑定を作れます。")
                            if !chatsOnly { Button("新しく鑑定する") { onNewReading() }.buttonStyle(FLPrimaryButtonStyle()) }
                        }
                            .listRowBackground(FateTheme.canvas)
                    }
                    if !reportReadings.isEmpty {
                        Section("鑑定書") { ForEach(reportReadings) { reading in readingLink(reading) } }
                    }
                    if !chatReadings.isEmpty {
                        Section("チャット履歴") { ForEach(chatReadings) { reading in readingLink(reading) } }
                    }
                    if !visibleReadings.isEmpty && !chatsOnly {
                        Button("新しく鑑定する") { onNewReading() }.buttonStyle(FLSecondaryButtonStyle()).listRowBackground(FateTheme.canvas)
                    }
                }.scrollContentBackground(.hidden)
                    .task { await load() }
            } else {
                ContentUnavailableView("鑑定履歴を保存", systemImage: "books.vertical",
                                       description: Text("無料登録すると、鑑定書と質問を続きから開けます。"))
            }
        }.background(FateTheme.canvas).fateScreenTitle(chatsOnly ? "チャット履歴" : "本棚")
            .toolbar { if auth.session == nil { Button("ログイン") { AuthPresentation.shared.isPresented = true } } }
    }

    private var visibleReadings: [ReadingSummary] { chatsOnly ? readings.filter(\.isChat) : readings }
    private var reportReadings: [ReadingSummary] { visibleReadings.filter { !$0.isChat } }
    private var chatReadings: [ReadingSummary] { visibleReadings.filter(\.isChat) }

    @ViewBuilder private func readingLink(_ reading: ReadingSummary) -> some View {
        NavigationLink {
            if reading.isChat { ReadingChatView(conversationID: reading.id) }
            else { SavedReadingView(conversationID: reading.id, readingKind: reading.kind) }
        } label: {
            HStack(spacing: 18) {
                ReadingNatureArtwork(index: reading.isCompatibility ? 10 : reading.isChat ? 5 : 0)
                    .frame(width: 64, height: 86).clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 10) {
                    Text(reading.isChat ? "対話" : reading.isCompatibility ? "ふたりの鑑定" : "あなたの鑑定")
                        .font(.caption).foregroundStyle(FateTheme.muted)
                    Text(reading.title).font(.body.weight(.medium)).lineSpacing(5)
                    Text("質問 \(reading.questionCount)件 ・ \(shortDate(reading.updatedAt ?? reading.createdAt))").font(.caption).foregroundStyle(FateTheme.muted)
                }
            }.padding(.vertical, 12)

        }.listRowBackground(FateTheme.card)
    }

    private func load() async {
        isLoading = true; errorMessage = nil
        defer { isLoading = false }
        do { readings = try await APIClient.shared.readings(auth: auth) }
        catch { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) }
    }

    private func shortDate(_ value: String?) -> String {
        guard let value else { return "" }
        return String(value.prefix(10)).replacingOccurrences(of: "-", with: "/")
    }
}
