import SwiftUI

struct ReadingListView: View {
    var onNewReading: () -> Void = {}
    @EnvironmentObject private var auth: AuthStore
    @State private var readings: [ReadingSummary] = []
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch
    @State private var isLoading = false

    var body: some View {
        Group {
            if auth.session != nil {
                List {
                    if isLoading { ProgressView("読み込んでいます…").frame(maxWidth: .infinity).listRowBackground(FateTheme.canvas) }
                    if let errorMessage {
                        FLErrorState(kind: errorKind) { Task { await load() } }
                            .listRowBackground(FateTheme.canvas)
                    }
                    if readings.isEmpty {
                        FLEmptyState(title: "まだ鑑定書がありません", message: "生年月日から鑑定書を作成すると、ここに保存されます。")
                            .listRowBackground(FateTheme.canvas)
                    }
                    Section("\(readings.count)件") {
                    ForEach(readings) { reading in
                    NavigationLink {
                        SavedReadingView(conversationID: reading.id, readingKind: reading.kind)
                    } label: {
                        FLListRow(title: reading.title, subtitle: "質問 \(reading.questionCount)件 ・ \(shortDate(reading.updatedAt ?? reading.createdAt))", showsChevron: false)
                    }.listRowBackground(FateTheme.canvas)
                    }
                    }
                    Button("新しく鑑定する") { onNewReading() }.buttonStyle(FLSecondaryButtonStyle()).listRowBackground(FateTheme.canvas)
                }.scrollContentBackground(.hidden)
                    .task { await load() }
            } else {
                ContentUnavailableView("鑑定履歴を保存", systemImage: "books.vertical",
                                       description: Text("無料登録すると、鑑定書と質問を続きから開けます。"))
            }
        }.background(FateTheme.canvas).fateScreenTitle("鑑定書一覧")
            .toolbar { if auth.session == nil { Button("ログイン") { AuthPresentation.shared.isPresented = true } } }
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
