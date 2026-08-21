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
                        if isWorking { Text("鑑定結果を読み解いています…").font(.system(size: 14)).foregroundStyle(FateTheme.secondaryText) }
                        Color.clear.frame(height: 72).id("bottom")
                    }.padding(18)
                }
                .defaultScrollAnchor(.bottom)
                .onChange(of: messages.count) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
            }

            if isBlocked { inlinePaywall }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                if let errorMessage { Text(errorMessage).font(.caption).foregroundStyle(.red) }
                HStack(alignment: .bottom, spacing: 10) {
                    TextField("鑑定結果について質問する…", text: $input, axis: .vertical)
                        .lineLimit(1...5).padding(12).background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    Button("送信") {
                        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !question.isEmpty else { return }
                        if isBlocked { showPaywall = true } else { Task { await send() } }
                    }.font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(FateTheme.buttonText).padding(.horizontal, 15).frame(height: 38)
                        .background(FateTheme.buttonBackground).clipShape(RoundedRectangle(cornerRadius: 12))
                        .disabled(isWorking)
                        .opacity(isWorking ? 0.4 : 1)
                }
            }.padding(14).background(FateTheme.ivory)
        }
        .background(FateTheme.ivory).fateScreenTitle(detail?.conversation.title ?? "鑑定結果への質問")
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
                        .font(.system(size: 16, design: .serif)).lineSpacing(8)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                }
                .background(FateTheme.ivory).fateScreenTitle("もとの鑑定書")
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
                    .font(.system(size: 13)).foregroundStyle(FateTheme.gold)
            }
        }
    }

    private func messageBubble(_ message: ReadingMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 24) }
            Text(message.content).font(.system(size: 16)).lineSpacing(7)
                .padding(message.role == "user" ? 14 : 0)
                .background(message.role == "user" ? Color(red: 0.937, green: 0.914, blue: 0.867) : .clear)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            if message.role != "user" { Spacer(minLength: 24) }
        }
    }

    private var inlinePaywall: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FATE LAB 継続鑑定").font(.caption).tracking(1).foregroundStyle(FateTheme.gold)
            Text("もう少し、深く読み解きますか。")
                .font(.system(size: 20, weight: .medium))
            Button("継続鑑定について詳しく見る") { showPaywall = true }.buttonStyle(OutlineGoldButtonStyle())
        }.padding(16).background(FateTheme.paper)
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
        messages.append(ReadingMessage(id: nil, role: "user", content: question, createdAt: nil))
        do {
            let answer = try await APIClient.shared.ask(conversationID: conversationID, question: question, auth: auth)
            messages.append(ReadingMessage(id: nil, role: "assistant", content: answer.text, createdAt: nil))
            followUpSuggestions = answer.suggestions
            await loadStatus()
        } catch {
            messages.removeLast(); input = question; errorMessage = userFacingMessage(error)
            if case APIError.paymentRequired = error { showPaywall = true }
            await loadStatus()
        }
        isWorking = false
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
                    Text("FATE LAB 継続鑑定").font(.caption).tracking(1).foregroundStyle(FateTheme.gold)
                    Text("この鑑定書を、\nいつでも開けるように。")
                        .font(.system(size: 30, weight: .medium, design: .serif)).lineSpacing(5)
                    VStack(alignment: .leading, spacing: 12) {
                        Label("鑑定結果について、回数の制限なく質問できます", systemImage: "checkmark")
                        Label("これまでの質問と回答は、いつでも読み返せます", systemImage: "checkmark")
                    }.lineSpacing(5)
                    Divider().overlay(FateTheme.line)
                    VStack(alignment: .leading, spacing: 5) {
                        if let product = purchases.product {
                            Text("月額 \(product.displayPrice)")
                                .font(.system(size: 24, weight: .semibold, design: .serif))
                            Text("1ヶ月ごとの自動更新").foregroundStyle(FateTheme.muted)
                        } else if purchases.errorMessage == nil {
                            ProgressView("商品情報を読み込んでいます…").tint(FateTheme.gold)
                        }
                    }
                    if let session = auth.session {
                        if purchases.product == nil, purchases.errorMessage != nil {
                            ReportCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("商品情報を取得できませんでした。通信環境をご確認のうえ、もう一度お試しください。")
                                    Button("再読み込み") { Task { await purchases.load() } }.buttonStyle(OutlineGoldButtonStyle())
                                }
                            }
                        } else {
                            Button("継続鑑定を始める") {
                                Task { await purchases.purchase(userID: session.user.id, auth: auth); onRefresh() }
                            }.buttonStyle(GoldButtonStyle()).disabled(purchases.product == nil || purchases.isWorking)
                        }
                        Button("購入を復元") {
                            Task { await purchases.restore(auth: auth); onRefresh() }
                        }.frame(maxWidth: .infinity).foregroundStyle(FateTheme.gold)
                    }
                    Text("期間終了の24時間前までに解約されない場合、自動的に更新されます。解約はApp Storeの設定からいつでも行えます。")
                        .font(.caption).foregroundStyle(FateTheme.muted).lineSpacing(5)
                    HStack {
                        Link("利用規約", destination: AppConfig.websiteBaseURL.appending(path: "/terms"))
                        Text("・")
                        Link("プライバシーポリシー", destination: AppConfig.websiteBaseURL.appending(path: "/privacy"))
                    }.font(.caption).frame(maxWidth: .infinity)
                }.padding(24)
            }.background(FateTheme.ivory)
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
            .background(FateTheme.paper)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
