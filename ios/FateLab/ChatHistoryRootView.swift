import SwiftUI

struct ChatHistoryRootView: View {
    private enum Scope: String, CaseIterable, Identifiable {
        case single = "あなた"
        case couple = "ふたり"
        var id: Self { self }
    }

    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    @State private var scope: Scope = .single
    @State private var readings: [ReadingSummary] = []
    @State private var isLoading = false
    @State private var errorKind: FLErrorState.Kind?

    var body: some View {
        Group {
            if auth.session == nil {
                ContentUnavailableView {
                    Label("対話", systemImage: "bubble.left.and.bubble.right")
                } description: {
                    Text("ログインすると、鑑定結果について質問できます。")
                } actions: {
                    Button("ログインする") { AuthPresentation.shared.isPresented = true }
                        .buttonStyle(FLPrimaryButtonStyle())
                }
            } else {
                List {
                    Picker("鑑定の種類", selection: $scope) {
                        ForEach(Scope.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(FateTheme.canvas)

                    if isLoading {
                        ProgressView("読み込んでいます…")
                            .frame(maxWidth: .infinity)
                            .listRowBackground(FateTheme.canvas)
                    } else if let errorKind {
                        FLErrorState(kind: errorKind) { Task { await load() } }
                            .listRowBackground(FateTheme.canvas)
                    } else {
                        Section("この鑑定書について聞く") {
                            if sourceReadings.isEmpty {
                                Text(scope == .single ? "先に「あなた」で鑑定書を作成してください。" : "先に「ふたり」で相性鑑定を作成してください。")
                                    .foregroundStyle(FateTheme.muted)
                            }
                            ForEach(sourceReadings) { reading in
                                Button {
                                    tabRouter.openChat(conversationID: reading.id, contextTitle: reading.title)
                                } label: {
                                    FLListRow(title: reading.title, subtitle: "この鑑定書をもとに質問する", showsChevron: true)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if !chatReadings.isEmpty {
                            Section("チャット履歴") {
                                ForEach(chatReadings) { reading in
                                    NavigationLink {
                                        ReadingChatView(conversationID: reading.id, contextTitle: reading.title)
                                    } label: {
                                        FLListRow(title: reading.title, subtitle: "質問 \(reading.questionCount)件", showsChevron: false)
                                    }
                                }
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
                .refreshable { await load() }
                .task { await load() }
            }
        }
        .background(FateTheme.canvas)
        .fateScreenTitle("対話")
    }

    private var sourceReadings: [ReadingSummary] {
        readings.filter { reading in
            guard !reading.isChat else { return false }
            return scope == .couple ? reading.isCompatibility : !reading.isCompatibility
        }
    }

    private var chatReadings: [ReadingSummary] {
        readings.filter(\.isChat)
    }

    private func load() async {
        guard auth.session != nil else { return }
        isLoading = true
        errorKind = nil
        defer { isLoading = false }
        do {
            readings = try await APIClient.shared.readings(auth: auth)
        } catch {
            errorKind = errorStateKind(error)
        }
    }
}
