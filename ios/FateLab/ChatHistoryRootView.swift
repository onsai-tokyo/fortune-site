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
                        Section("相談する鑑定書") {
                            if sourceReadings.isEmpty {
                                Text(scope == .single ? "先に「あなた」で鑑定書を作成してください。" : "先に「ふたり」タブでお相手を登録し、相性鑑定を作成してください。")
                                    .foregroundStyle(FateTheme.muted)
                                if scope == .couple {
                                    Button("ふたりタブへ") { tabRouter.selectTab(.couple) }
                                }
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

                        if let reading = sourceReadings.first {
                            Section("よくある質問から始める") {
                                ForEach(questionExamples, id: \.self) { question in
                                    Button {
                                        tabRouter.openChat(conversationID: reading.id, contextTitle: reading.title, draftQuestion: question)
                                    } label: {
                                        FLListRow(title: question, showsChevron: true)
                                    }
                                    .buttonStyle(.plain)
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
        .toolbar {
            if auth.session != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink { ReadingListView(chatsOnly: true) } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                    .accessibilityLabel("チャット履歴")
                }
            }
        }
    }

    private var sourceReadings: [ReadingSummary] {
        readings.filter { reading in
            guard !reading.isChat else { return false }
            return scope == .couple ? reading.isCompatibility : !reading.isCompatibility
        }
    }

    private var questionExamples: [String] {
        switch scope {
        case .single:
            ["これから3年の流れを知りたい", "恋愛の転機を詳しく知りたい", "仕事で次に動くタイミングを知りたい", "自分の弱点をどう活かせばいい？"]
        case .couple:
            ["この人との関係はこれからどうなる？", "相手は私をどう感じやすい？", "二人がすれ違いやすいポイントは？", "復縁や結婚につながりやすい時期は？"]
        }
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
