import SwiftUI

struct ChatHistoryRootView: View {
    var api: APIClient = .shared
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
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                    Text("鑑定の続きを、対話で。")
                        .font(FateType.screenTitle).lineSpacing(6)
                    Text("気になった一節から、もう少し深く。")
                        .font(.subheadline).foregroundStyle(FateTheme.muted)
                    Picker("鑑定の種類", selection: $scope) {
                        ForEach(Scope.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(FateTheme.canvas)

                    if isLoading {
                        FateInlineLoading(title: "読み込んでいます")
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
                                NavigationLink {
                                    ReadingChatView(conversationID: reading.id, contextTitle: reading.title, api: api)
                                } label: {
                                    HStack(spacing: 14) {
                                        Image(systemName: "book.closed").font(.title3).foregroundStyle(FateTheme.muted)
                                        VStack(alignment: .leading, spacing: 6) {
                                            Text(reading.title).font(.body.weight(.medium))
                                            Text("この鑑定書をもとに対話").font(.caption).foregroundStyle(FateTheme.muted)
                                        }
                                        Spacer(minLength: 8)
                                        Image(systemName: "chevron.right").font(.caption)
                                    }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                                        .background(FateTheme.surface, in: RoundedRectangle(cornerRadius: 18))
                                        .contentShape(Rectangle())
                                }.buttonStyle(.plain)
                                    .accessibilityIdentifier("chat.source.\(reading.id)")
                            }
                        }

                        if let reading = sourceReadings.first {
                            Section("よくある質問から始める") {
                                ForEach(questionExamples, id: \.self) { question in
                                    NavigationLink {
                                        ReadingChatView(conversationID: reading.id, contextTitle: reading.title, draftQuestion: question, api: api)
                                    } label: {
                                        HStack(alignment: .top, spacing: 14) {
                                            Image(systemName: "bubble.left").foregroundStyle(FateTheme.muted)
                                            Text(question).font(.body).lineSpacing(5)
                                                .fixedSize(horizontal: false, vertical: true)
                                            Spacer(minLength: 0)
                                            Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(FateTheme.muted)
                                        }.padding(18).frame(maxWidth: .infinity, minHeight: 62, alignment: .leading)
                                            .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 16))
                                            .contentShape(Rectangle())
                                    }.buttonStyle(.plain)
                                        .accessibilityIdentifier("chat.question.\(question)")
                                }
                            }
                        }
                    }
                    }.padding(.horizontal, FateSpacing.screenH).padding(.vertical, 24)
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
            readings = try await api.readings(auth: auth)
        } catch {
            errorKind = errorStateKind(error)
        }
    }
}
