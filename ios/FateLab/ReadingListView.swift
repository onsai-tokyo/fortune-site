import SwiftUI

struct ReadingListView: View {
    var onNewReading: () -> Void = {}
    @EnvironmentObject private var auth: AuthStore
    @State private var readings: [ReadingSummary] = []
    @State private var errorMessage: String?
    @State private var path: [UUID] = []
    @State private var isLoading = false

    var body: some View {
        Group {
            if auth.session != nil {
                List {
                    if isLoading { ProgressView("読み込んでいます…").frame(maxWidth: .infinity).listRowBackground(FateTheme.background) }
                    if let errorMessage {
                        VStack(spacing: 12) {
                            Text("読み込めませんでした").font(.headline)
                            Text(errorMessage).font(.footnote).foregroundStyle(FateTheme.secondaryText)
                            Button("再試行") { Task { await load() } }.buttonStyle(OutlineGoldButtonStyle())
                        }.listRowBackground(FateTheme.background)
                    }
                    if readings.isEmpty {
                        VStack(spacing: 14) {
                            Text("まだ鑑定書がありません").font(.system(size: 21, weight: .medium, design: .serif))
                            Text("生年月日から鑑定書を作成すると、ここに保存されます。")
                                .font(.footnote).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 40).listRowBackground(FateTheme.paper)
                    }
                    Section("\(readings.count)件") {
                    ForEach(readings) { reading in
                    NavigationLink(value: reading.id) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(reading.title).font(.system(size: 18, weight: .medium, design: .serif))
                            Text("質問 \(reading.questionCount)件 ・ \(shortDate(reading.updatedAt ?? reading.createdAt))")
                                .font(.caption).foregroundStyle(FateTheme.muted)
                        }.padding(.vertical, 8)
                    }.listRowBackground(FateTheme.paper)
                    }
                    }
                    Button("新しく鑑定する") { onNewReading() }.buttonStyle(OutlineGoldButtonStyle()).listRowBackground(FateTheme.ivory)
                }.scrollContentBackground(.hidden)
                    .task { await load() }
            } else {
                ContentUnavailableView("鑑定履歴を保存", systemImage: "books.vertical",
                                       description: Text("無料登録すると、鑑定書と質問を続きから開けます。"))
            }
        }.background(FateTheme.ivory).fateScreenTitle("鑑定書一覧")
            .navigationDestination(for: UUID.self) { SavedReadingView(conversationID: $0) }
            .toolbar { if auth.session == nil { Button("ログイン") { AuthPresentation.shared.isPresented = true } } }
    }

    private func load() async {
        isLoading = true; errorMessage = nil
        defer { isLoading = false }
        do { readings = try await APIClient.shared.readings(auth: auth) }
        catch { errorMessage = error.localizedDescription }
    }

    private func shortDate(_ value: String?) -> String {
        guard let value else { return "" }
        return String(value.prefix(10)).replacingOccurrences(of: "-", with: "/")
    }
}
