import SwiftUI

struct ReadingChatView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    let conversationID: UUID
    @State private var detail: ConversationDetail?
    @State private var messages: [ReadingMessage] = []
    @State private var status: ReadingStatus?
    @State private var input = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var showPaywall = false
    @State private var showSourceReport = false
    @State private var followUpSuggestions: [String] = []
    @State private var didLoad = false
    @State private var shouldFollowLatest = true
    @State private var streamRevision = 0
    @State private var forceScrollRevision = 0
    @State private var lastStreamScroll = Date.distantPast
    @State private var streamTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        if let status, !status.premium {
                            freeUsageStatus(status)
                        }
                        if messages.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("どこから読み解きますか？")
                                    .font(.system(size: 22, weight: .medium))
                                Text("鑑定書で気になった部分を、そのまま質問できます。")
                                    .foregroundStyle(FateTheme.muted).lineSpacing(6)
                                ForEach(suggestions, id: \.self) { suggestion in
                                    Button(suggestion) { input = suggestion }
                                        .buttonStyle(SuggestionButtonStyle())
                                }
                            }
                        }
                        ForEach(Array(messages.enumerated()), id: \.offset) { _, message in
                            messageBubble(message)
                        }
                        if messages.last?.role == "assistant" && !isBlocked && !followUpSuggestions.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("続けて読み解く").font(.system(size: 16, weight: .medium)).padding(.bottom, 2)
                                ForEach(followUpSuggestions, id: \.self) { suggestion in
                                    Button(suggestion) { input = suggestion }
                                        .buttonStyle(SuggestionButtonStyle())
                                }
                            }.padding(.top, 4)
                        }
                        if isWorking { Text("鑑定結果を読み解いています…").font(.system(size: 14)).foregroundStyle(FateTheme.muted) }
                        Color.clear.frame(height: 72).id("bottom")
                    }.padding(18)
                }
                .defaultScrollAnchor(.bottom)
                .simultaneousGesture(DragGesture().onChanged { _ in shouldFollowLatest = false })
                .onChange(of: forceScrollRevision) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                .onChange(of: streamRevision) { _, _ in
                    guard shouldFollowLatest, Date().timeIntervalSince(lastStreamScroll) >= 0.15 else { return }
                    lastStreamScroll = Date()
                    withAnimation(.easeOut(duration: 0.15)) { proxy.scrollTo("bottom") }
                }
            }

            if isBlocked { inlinePaywall }
            if !shouldFollowLatest {
                Button("最新へ戻る") { shouldFollowLatest = true; forceScrollRevision += 1 }
                    .font(.caption).padding(.vertical, 8)
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
                HStack(alignment: .bottom, spacing: 10) {
                    TextField("鑑定について聞く…", text: $input, axis: .vertical)
                        .lineLimit(1...5).padding(12).background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    Button {
                        if isWorking { streamTask?.cancel(); return }
                        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !question.isEmpty else { return }
                        if isBlocked { showPaywall = true } else { streamTask = Task { await send() } }
                    } label: { Image(systemName: isWorking ? "stop.fill" : "arrow.up").font(.system(size: 15, weight: .bold)).foregroundStyle(.white).frame(width: 44, height: 44).background(FateTheme.ink).clipShape(Circle()) }
                    .accessibilityLabel(isWorking ? "回答を停止" : "送信")
                }
            }.padding(14).background(FateTheme.canvas)
        }
        .background(FateTheme.canvas).fateScreenTitle(detail?.conversation.title ?? "鑑定結果への質問")
        .onAppear {
            guard !didLoad else { return }
            didLoad = true
            Task { await load() }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showSourceReport = true } label: { Image(systemName: "doc.text") }
                    .disabled(detail?.conversation.reportText == nil)
                    .accessibilityLabel("もとの鑑定書を確認")
            }
        }
        .sheet(isPresented: $showSourceReport) {
            NavigationStack {
                ScrollView {
                    Text(detail?.conversation.reportText ?? "")
                        .font(.system(size: 16)).lineSpacing(8)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                }
                .background(FateTheme.canvas).fateScreenTitle("もとの鑑定書")
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { showSourceReport = false } } }
            }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallSheet(draftQuestion: input) {
                Task { await loadStatus(); if status?.premium == true { showPaywall = false } }
            }
            .environmentObject(auth).environmentObject(purchases)
        }
    }

    private var isBlocked: Bool { status.map { !$0.premium && ($0.remaining ?? 0) == 0 } ?? false }
    private let suggestions = ["恋愛の流れを詳しく知りたい", "仕事の転機を詳しく知りたい", "これから3年の流れを知りたい"]

    @ViewBuilder private func freeUsageStatus(_ status: ReadingStatus) -> some View {
        let remaining = status.remaining ?? 0
        VStack(alignment: .leading, spacing: 5) {
            Text(remaining > 0 ? "無料でお読みいただける残り：\(remaining)回" : "無料分をご利用いただきました")
                .font(.system(size: 14)).foregroundStyle(FateTheme.muted)
            if remaining == 1 {
                Button("継続鑑定では、回数の制限なくお読みいただけます") { showPaywall = true }
                    .font(.system(size: 13)).foregroundStyle(FateTheme.ink)
            }
        }
    }

    private func messageBubble(_ message: ReadingMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 24) }
            if message.role == "assistant" {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) { FateMark(size: 18); Text("FATE LAB").font(.system(size: 11, weight: .medium)).tracking(2) }
                    if message.content.isEmpty && isWorking { Text("•••").foregroundStyle(FateTheme.muted) }
                    else { Text(styledAnswer(message.content)).font(.system(size: 16)).lineSpacing(7).foregroundStyle(FateTheme.body) }
                }
            } else {
                Text(message.content).font(.system(size: 15)).foregroundStyle(FateTheme.canvas).padding(.horizontal, 14).padding(.vertical, 11).background(FateTheme.ink).clipShape(RoundedRectangle(cornerRadius: 16))
            }
            if message.role != "user" { Spacer(minLength: 24) }
        }
    }

    private func styledAnswer(_ content: String) -> AttributedString {
        var result = AttributedString(content)
        if let end = result.characters.firstIndex(where: { "。！？".contains($0) }) { result[result.startIndex...end].font = .system(size: 16, weight: .bold) }
        return result
    }

    private var inlinePaywall: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FATE LAB 継続鑑定").font(.caption).tracking(1).foregroundStyle(FateTheme.ink)
            Text("もう少し、深く読み解きますか。")
                .font(.system(size: 20, weight: .medium))
            Button("継続鑑定について詳しく見る") { showPaywall = true }.buttonStyle(FLSecondaryButtonStyle())
        }.padding(16).background(FateTheme.surface)
            .overlay(Rectangle().frame(height: 1).foregroundStyle(FateTheme.line), alignment: .top)
    }

    private func load() async {
        guard auth.session != nil else { return }
        do {
            let value = try await APIClient.shared.conversation(id: conversationID, auth: auth)
            detail = value; messages = value.messages
            await loadStatus()
        } catch { errorMessage = userFacingMessage(error) }
    }

    private func loadStatus() async {
        guard auth.session != nil else { return }
        status = try? await APIClient.shared.status(auth: auth)
    }

    private func send() async {
        guard auth.session != nil else { return }
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        input = ""; errorMessage = nil; isWorking = true
        shouldFollowLatest = true
        messages.append(ReadingMessage(id: nil, role: "user", content: question, createdAt: nil))
        let firstNewIndex = messages.count - 1
        messages.append(ReadingMessage(id: nil, role: "assistant", content: "", createdAt: nil))
        let assistantIndex = messages.count - 1
        forceScrollRevision += 1
        do {
            var didFinish = false
            for try await event in APIClient.shared.askStream(conversationID: conversationID, question: question, auth: auth) {
                switch event {
                case .delta(let text):
                    messages[assistantIndex].content += text
                    streamRevision += 1
                case .meta(let suggestions): followUpSuggestions = suggestions
                case .done: didFinish = true
                }
            }
            if !didFinish { throw CancellationError() }
            await loadStatus()
        } catch {
            messages.removeSubrange(firstNewIndex..<messages.count)
            input = question; errorMessage = userFacingMessage(error)
            if case APIError.paymentRequired = error { showPaywall = true }
            await loadStatus()
        }
        isWorking = false
        streamTask = nil
    }
}

private struct PaywallSheet: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @Environment(\.dismiss) private var dismiss
    let draftQuestion: String
    let onRefresh: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    let draft = draftQuestion.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !draft.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("お書きになった質問").font(.caption).foregroundStyle(FateTheme.muted)
                            Text("「\(draft)」").lineLimit(3).font(.system(size: 15))
                        }
                        Divider().overlay(FateTheme.line)
                    }
                    Text("無料でお読みいただける2回分を、ご利用いただきました。")
                        .font(.system(size: 15)).foregroundStyle(FateTheme.muted)
                    Text("FATE LAB 継続鑑定").font(.caption).tracking(1).foregroundStyle(FateTheme.ink)
                    Text("この鑑定書を、\nいつでも開けるように。")
                        .font(.system(size: 30, weight: .medium)).lineSpacing(5)
                    VStack(alignment: .leading, spacing: 12) {
                        Label("鑑定結果について、回数の制限なく質問できます", systemImage: "checkmark")
                        Label("これまでの質問と回答は、いつでも読み返せます", systemImage: "checkmark")
                    }.lineSpacing(5)
                    Divider().overlay(FateTheme.line)
                    VStack(alignment: .leading, spacing: 5) {
                        if let product = purchases.product {
                            Text("月額 \(product.displayPrice)")
                                .font(.system(size: 24, weight: .semibold))
                            Text("1ヶ月ごとの自動更新").foregroundStyle(FateTheme.muted)
                        } else if purchases.errorMessage == nil {
                            ProgressView("商品情報を読み込んでいます…").tint(FateTheme.ink)
                        }
                    }
                    if let session = auth.session {
                        if purchases.product == nil, purchases.errorMessage != nil {
                            ReportCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("商品情報を取得できませんでした。通信環境をご確認のうえ、もう一度お試しください。")
                                    Button("再読み込み") { Task { await purchases.load() } }.buttonStyle(FLSecondaryButtonStyle())
                                }
                            }
                        } else {
                            Button("継続鑑定を始める") {
                                Task { await purchases.purchase(userID: session.user.id, auth: auth); onRefresh() }
                            }.buttonStyle(FLPrimaryButtonStyle()).disabled(purchases.product == nil || purchases.isWorking)
                        }
                        Button("購入を復元") {
                            Task { await purchases.restore(auth: auth); onRefresh() }
                        }.frame(maxWidth: .infinity).foregroundStyle(FateTheme.ink)
                    }
                    Text("期間終了の24時間前までに解約されない場合、自動的に更新されます。解約はApp Storeの設定からいつでも行えます。")
                        .font(.caption).foregroundStyle(FateTheme.muted).lineSpacing(5)
                    HStack {
                        Link("利用規約", destination: AppConfig.websiteBaseURL.appending(path: "/terms"))
                        Text("・")
                        Link("プライバシーポリシー", destination: AppConfig.websiteBaseURL.appending(path: "/privacy"))
                    }.font(.caption).frame(maxWidth: .infinity)
                }.padding(24)
            }.background(FateTheme.canvas)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { dismiss() } label: { Image(systemName: "xmark") }
                            .frame(width: 44, height: 44).accessibilityLabel("閉じる")
                    }
                }
        }.presentationDetents([.large])
    }
}

private struct SuggestionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(FateTheme.ink)
            .padding(.horizontal, 14).padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.surface)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
