import SwiftUI
import StoreKit

struct ReadingChatView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @EnvironmentObject private var tabRouter: AppTabRouter
    let conversationID: UUID
    let contextTitle: String?
    private let api: APIClient
    @State private var activeConversationID: UUID
    @State private var detail: ConversationDetail?
    @State private var messages: [ReadingMessage] = []
    @State private var status: ReadingStatus?
    @State private var input = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var conversationMissing = false
    @State private var showPaywall = false
    @State private var showSourceReport = false
    @State private var followUpSuggestions: [String] = []
    @State private var didLoad = false
    @State private var shouldFollowLatest = true
    @State private var streamRevision = 0
    @State private var forceScrollRevision = 0
    @State private var lastStreamScroll = Date.distantPast
    @State private var streamTask: Task<Void, Never>?
    @State private var isSaved = false
    @State private var isSaving = false
    @State private var saveMessage: String?
    @FocusState private var isInputFocused: Bool

    init(conversationID: UUID, contextTitle: String? = nil, draftQuestion: String? = nil, api: APIClient = .shared) {
        self.api = api
        self.conversationID = conversationID
        self.contextTitle = contextTitle
        _activeConversationID = State(initialValue: conversationID)
        _input = State(initialValue: draftQuestion ?? "")
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        if let contextTitle, !contextTitle.isEmpty {
                            Text("「\(contextTitle)」について質問できます")
                                .font(.caption)
                                .foregroundStyle(FateTheme.muted)
                        }
                        if let status, !status.premium {
                            freeUsageStatus(status)
                        }
                        if messages.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("どこから読み解きますか？")
                                    .font(.system(.title2, weight: .medium))
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
                                Text("続けて読み解く").font(.system(.body, weight: .medium)).padding(.bottom, 2)
                                ForEach(followUpSuggestions, id: \.self) { suggestion in
                                    Button(suggestion) { input = suggestion }
                                        .buttonStyle(SuggestionButtonStyle())
                                }
                            }.padding(.top, 4)
                        }
                        if isWorking { FateInlineLoading(title: "鑑定結果を読み解いています") }
                        Color.clear.frame(height: 72).id("bottom")
                    }.padding(18)
                }
                .defaultScrollAnchor(.bottom)
                .scrollDismissesKeyboard(.interactively)
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
                if let errorMessage {
                    HStack(spacing: 10) {
                        Text(errorMessage).font(.caption).foregroundStyle(.red)
                        Spacer()
                        if conversationMissing {
                            Button("鑑定一覧へ") { tabRouter.closeMissingChat() }.font(.caption.weight(.semibold))
                        } else if !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Button("もう一度送る") { streamTask = Task { await send() } }.font(.caption.weight(.semibold))
                        }
                    }
                }
                AISharingNoticeView()
                HStack(alignment: .bottom, spacing: 6) {
                    TextField("鑑定について聞く…", text: $input, axis: .vertical)
                        .accessibilityIdentifier("chat.input")
                        .focused($isInputFocused)
                        .lineLimit(1...5).padding(.leading, 12).padding(.vertical, 12)
                    Button {
                        if isWorking { streamTask?.cancel(); return }
                        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !question.isEmpty, !isWorking else { return }
                        if isBlocked { showPaywall = true } else { streamTask = Task { await send() } }
                    } label: { Text(isWorking ? "停止" : (isBlocked ? "プランを見る" : "鑑定する")).font(.system(.caption, weight: .semibold)).foregroundStyle(.white).padding(.horizontal, 12).frame(minHeight: 44).background(FateTheme.ink, in: Capsule()) }
                    .accessibilityLabel(isWorking ? "回答を停止" : (isBlocked ? "プランを見る" : "鑑定する"))
                    .padding(.trailing, 5).padding(.vertical, 5)
                }.background(FateTheme.card).clipShape(RoundedRectangle(cornerRadius: 26)).overlay(RoundedRectangle(cornerRadius: 26).stroke(FateTheme.line, lineWidth: 0.7))
                Button { Task { await saveConversation() } } label: {
                    Label(isSaved ? "保存済み" : "この鑑定を保存する", systemImage: isSaved ? "bookmark.fill" : "bookmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(FLSecondaryButtonStyle())
                .disabled(isSaved || isSaving)
                if let saveMessage {
                    Text(saveMessage).font(.caption).foregroundStyle(saveMessage == "保存しました" ? FateTheme.muted : .red)
                }
            }.padding(16).background(FateTheme.canvas)
                .overlay(alignment: .top) { Rectangle().fill(FateTheme.line).frame(height: 0.5) }
        }
        .background(FateTheme.canvas).fateScreenTitle(detail?.conversation.title ?? "鑑定結果への質問")
        .onAppear {
            guard !didLoad else { return }
            didLoad = true
#if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--ui-chat89-preview") {
                messages = [ReadingMessage(id: nil, role: "user", content: "自分のペースで働くために、何を大切にするとよいですか？", createdAt: nil), ReadingMessage(id: nil, role: "assistant", content: "これは表示確認用のサンプルです。\n\n一度にすべてを変えるより、気持ちよく続けられることを一つずつ確かめる時間をつくってみましょう。自分に合うリズムを知ることが、次の選択の手がかりになります。", createdAt: nil)]
                return
            }
#endif
            Task { await load() }
        }
        .onDisappear { isInputFocused = false; streamTask?.cancel() }
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
                        .font(.system(.body)).lineSpacing(8)
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
                .font(.system(.footnote)).foregroundStyle(FateTheme.muted)
            if remaining == 1 {
                Button("継続鑑定の利用内容を確認する") { showPaywall = true }
                    .font(.system(.caption)).foregroundStyle(FateTheme.ink)
            }
        }
    }

    private func messageBubble(_ message: ReadingMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 24) }
            if message.role == "assistant" {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) { FateMark(size: 18); Text("FATE LAB").font(.system(.caption2, weight: .medium)).tracking(2) }
                    if message.content.isEmpty && isWorking { Text("•••").foregroundStyle(FateTheme.muted) }
                    else { Text(styledAnswer(message.content)).font(.system(.body)).lineSpacing(7).foregroundStyle(FateTheme.body) }
                }
                .padding(22).background(FateTheme.card, in: RoundedRectangle(cornerRadius: FLRadius.card))
                .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(FateTheme.line, lineWidth: 0.5))
            } else {
                Text(message.content).font(.system(.subheadline)).foregroundStyle(FateTheme.canvas).padding(.horizontal, 14).padding(.vertical, 11).background(FateTheme.ink).clipShape(RoundedRectangle(cornerRadius: 16))
            }
            if message.role != "user" { Spacer(minLength: 24) }
        }
    }

    private func styledAnswer(_ content: String) -> AttributedString {
        var result = AttributedString(content)
        if let end = result.characters.firstIndex(where: { "。！？".contains($0) }) { result[result.startIndex...end].font = .system(.body, weight: .bold) }
        return result
    }

    private var inlinePaywall: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FATE LAB 継続鑑定").font(.caption).tracking(1).foregroundStyle(FateTheme.ink)
            Text("もう少し、深く読み解きますか。")
                .font(.system(.title3, weight: .medium))
            Button("継続鑑定について詳しく見る") { showPaywall = true }.buttonStyle(FLSecondaryButtonStyle())
        }.padding(16).background(FateTheme.surface)
            .overlay(Rectangle().frame(height: 1).foregroundStyle(FateTheme.line), alignment: .top)
    }

    private func load() async {
        let owner = AccountScope(auth)
        guard auth.session != nil else { return }
        do {
            let pendingDraft = try await api.recoverQuestionDraft(conversationID: activeConversationID, auth: auth)
            try owner.check(auth)
            let value = try await api.conversation(id: activeConversationID, auth: auth)
            try owner.check(auth)
            detail = value; messages = value.messages; isSaved = value.conversation.isSaved ?? false
            if input.isEmpty, let pendingDraft { input = pendingDraft }
            await loadStatus()
        } catch { if owner.isCurrent(auth) { handleChatError(error) } }
    }

    private func saveConversation() async {
        let owner = AccountScope(auth)
        guard !isSaved, !isSaving else { return }
        isSaving = true; saveMessage = nil
        defer { if owner.isCurrent(auth) { isSaving = false } }
        do {
            try await api.setConversationSaved(id: activeConversationID, isSaved: true, auth: auth)
            try owner.check(auth)
            isSaved = true
            saveMessage = "保存しました"
        } catch {
            guard owner.isCurrent(auth) else { return }
            saveMessage = userFacingMessage(error) ?? "鑑定を保存できませんでした。もう一度お試しください。"
        }
    }

    private func loadStatus() async {
        let owner = AccountScope(auth)
        guard auth.session != nil else { return }
        do {
            let value = try await api.status(auth: auth)
            try owner.check(auth)
            status = value
        } catch { if owner.isCurrent(auth) { status = nil; handleChatError(error) } }
    }

    private func send() async {
        let owner = AccountScope(auth)
        guard auth.session != nil else { return }
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isWorking else { return }
        let needsNewThread = activeConversationID == conversationID && detail?.conversation.kind != "chat" && messages.isEmpty
        input = ""; errorMessage = nil; isWorking = true
        shouldFollowLatest = true
        messages.append(ReadingMessage(id: nil, role: "user", content: question, createdAt: nil))
        let firstNewIndex = messages.count - 1
        messages.append(ReadingMessage(id: nil, role: "assistant", content: "", createdAt: nil))
        let assistantIndex = messages.count - 1
        forceScrollRevision += 1
        do {
            if needsNewThread {
                let created = try await api.createChatConversation(sourceID: activeConversationID, question: question, auth: auth)
                try owner.check(auth)
                activeConversationID = created
                detail = try await api.conversation(id: activeConversationID, auth: auth)
                try owner.check(auth)
                isSaved = true
            }
            var didFinish = false
            for try await event in api.askStream(conversationID: activeConversationID, question: question, auth: auth, aiConsentVersion: AISharingConsent.version) {
                try owner.check(auth)
                switch event {
                case .delta(let text):
                    messages[assistantIndex].content += text
                    streamRevision += 1
                case .meta(let suggestions): followUpSuggestions = suggestions
                case .done: didFinish = true
                }
            }
            if !didFinish { throw CancellationError() }
            // A failed history refresh cannot undo an acknowledged saved answer or
            // restore its input as a new question with a new operation ID.
            do {
                let saved = try await api.conversation(id: activeConversationID, auth: auth)
                try owner.check(auth)
                detail = saved; messages = saved.messages
            } catch {
                guard owner.isCurrent(auth) else { return }
                handleChatError(error)
            }
            await loadStatus()
        } catch {
            guard owner.isCurrent(auth) else { return }
            messages.removeSubrange(firstNewIndex..<messages.count)
            if isMissingConversation(error) { input = "" } else { input = question }
            handleChatError(error)
            if case APIError.paymentRequired = error { showPaywall = true }
            await loadStatus()
        }
        guard owner.isCurrent(auth) else { return }
        isWorking = false
        streamTask = nil
    }

    private func handleChatError(_ error: Error) {
        if isMissingConversation(error) {
            conversationMissing = true
            errorMessage = "この鑑定を開き直してください。"
        } else if case APIError.http(status: 500, message: let message) = error,
                  message.contains("対話") {
            conversationMissing = false
            errorMessage = message
        } else {
            conversationMissing = false
            errorMessage = userFacingMessage(error)
        }
    }

    private func isMissingConversation(_ error: Error) -> Bool {
        if case APIError.http(status: 404, message: _) = error { return true }
        return false
    }
}

struct PaywallSheet: View {
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
                            Text("「\(draft)」").lineLimit(3).font(.system(.subheadline))
                        }
                        Divider().overlay(FateTheme.line)
                    }
                    if !AppConfig.storeKitEnabled {
                        Text(AppConfig.purchasesUnavailableMessage).font(.headline)
                        Text("この操作には利用権限の確認が必要です。入力した質問はそのまま残ります。")
                            .foregroundStyle(FateTheme.muted)
                    } else {
                    Text("あなたを知る言葉を、日々の選択に。")
                        .font(.system(.subheadline)).foregroundStyle(FateTheme.muted)
                    FateEditorialHero(eyebrow: "MEMBERSHIP", title: purchases.isPremium ? "あなたのメンバーシップ" : "あなたと、ふたりを\nもっと深く知る。", subtitle: "FATE LAB 継続鑑定")
                    if purchases.isPremium { MembershipActiveBanner() }
                    VStack(alignment: .leading, spacing: 5) {
                        if let product = purchases.product {
                            Text(ReadingPrices.monthly)
                            StorePurchasePrice(product: product)
                                .font(.system(.title2, weight: .semibold))
                            Text("1ヶ月ごとの自動更新").foregroundStyle(FateTheme.muted)
                        } else if purchases.errorMessage == nil {
                            ProgressView("商品情報を読み込んでいます…").tint(FateTheme.ink)
                        }
                    }
                    if let session = auth.session {
                        if purchases.isPremium {
                            Button("会員として利用を続ける") { onRefresh(); dismiss() }.buttonStyle(FLPrimaryButtonStyle())
                        } else if purchases.accessState == .unknown || purchases.isSyncing {
                            if purchases.isSyncing {
                                ProgressView("購入状況を確認しています…").tint(FateTheme.ink)
                            } else {
                                Text("購入状況を確認できませんでした。もう一度確認してください。").font(.callout)
                            }
                            Button("購入状況を再確認") { Task { await purchases.sync(auth: auth) } }.disabled(purchases.isSyncing)
                        } else if !purchases.hasStoreKitEntitlement, purchases.product == nil, purchases.errorMessage != nil {
                            ReportCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("商品情報を取得できませんでした。通信環境をご確認のうえ、もう一度お試しください。")
                                    Button("再読み込み") { Task { await purchases.load() } }.buttonStyle(FLSecondaryButtonStyle())
                                }
                            }
                        } else {
                            Button(purchases.membershipActionTitle) {
                                Task { await purchases.purchase(userID: session.user.id, auth: auth); onRefresh() }
                            }.buttonStyle(FLPrimaryButtonStyle()).disabled(!purchases.canStartMembership)
                        }
                        Button("購入を復元") {
                            Task { await purchases.restore(auth: auth); onRefresh() }
                        }.frame(maxWidth: .infinity, minHeight: 44).foregroundStyle(FateTheme.ink)
                    }
                    if purchases.isWorking { ProgressView("購入手続き中…").tint(FateTheme.ink) }
                    if let error = purchases.errorMessage {
                        Text(error).font(.footnote).foregroundStyle(FateTheme.danger)
                    }
                    Divider().overlay(FateTheme.line)
                    MembershipDetailsView()
                    Text("期間終了の24時間前までに解約されない場合、自動的に更新されます。解約はApp Storeの設定からいつでも行えます。")
                        .font(.caption).foregroundStyle(FateTheme.muted).lineSpacing(5)
                    HStack {
                        Link("利用規約", destination: AppConfig.websiteBaseURL.appending(path: "/terms"))
                        Text("・")
                        Link("プライバシーポリシー", destination: AppConfig.websiteBaseURL.appending(path: "/privacy"))
                    }.font(.caption).frame(maxWidth: .infinity)
                    }
                }.padding(24)
            }.background(FateTheme.canvas)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { dismiss() } label: { Image(systemName: "xmark") }
                            .frame(width: 44, height: 44).accessibilityLabel("閉じる")
                    }
                }
        }.presentationDetents([.large])
            .task { await purchases.sync(auth: auth); await purchases.load() }
    }
}

private struct SuggestionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.subheadline, weight: .medium))
            .foregroundStyle(FateTheme.ink)
            .padding(.horizontal, 16).padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(FateTheme.card)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line, lineWidth: 0.7))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}


struct MembershipDetailsView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var booksEnabled = false
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("月額1,980円（日本価格）").font(.headline)
            VStack(alignment: .leading, spacing: 12) {
            Label("相手のプロフィールを10人まで登録", systemImage: "person.2")
            Label("相性の有料項目と2027年以降の時系列が見放題", systemImage: "lock.open")
            Text("会員期間中は、良好な関係を築くコツ・障害になること・復縁の可能性と、あなた・ふたりの各年の鑑定を読めます。")
                .font(.footnote).foregroundStyle(FateTheme.muted)
            Text("無料プランは1人まで。登録済みの相手は、会員期間が終わっても残ります。")
                .font(.footnote).foregroundStyle(FateTheme.muted)
            }.membershipFeature()
            VStack(alignment: .leading, spacing: 12) {
            Label("相談からつくる鑑定書が、初月から毎月3通", systemImage: "book.closed")
            if !booksEnabled {
                Text("「鑑定書をつくる」タブで相談を入力し、保存した鑑定をもとに約5,000文字の一冊を作成できます。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
            }
            Text("会員分はAppleの更新日ごとに付与され、未使用分は繰り越されません。追加の単品購入分に有効期限はありません。")
                .font(.footnote).foregroundStyle(FateTheme.muted)
            }.membershipFeature()
            VStack(alignment: .leading, spacing: 12) {
            Label("お届けした鑑定書は、解約後も本棚に", systemImage: "books.vertical")
            Text("単品購入した鑑定カードは、会員期間が終わっても読み返せます。相談鑑定書の単品購入とは別の商品です。")
                .font(.footnote).foregroundStyle(FateTheme.muted)
            }.membershipFeature()
            Text("月額プランは1ヶ月ごとの自動更新です。料金は購入前のAppleの確認画面でもご確認いただけます。")
                .font(.footnote).foregroundStyle(FateTheme.muted)
        }.lineSpacing(5)
            .task(id: AccountScope(auth)) {
                booksEnabled = false
                let owner = AccountScope(auth)
                if let status = try? await APIClient.shared.bookCall(AIBookStatus.self, path: "/status", auth: auth), owner.isCurrent(auth) {
                    booksEnabled = status.enabled
                }
            }
    }
}

enum ReadingPrices {
    static let card = "300円（日本価格）"
    static let monthly = "1,980円／月（日本価格）"
}

/// Keep the Japanese catalogue prominent without misrepresenting Apple's actual charge.
struct StorePurchasePrice: View {
    let product: Product?
    var body: some View {
        if let product {
            if product.priceFormatStyle.currencyCode != "JPY" {
                Text("このAppleアカウントでの購入価格：\(product.displayPrice)。日本価格とは通貨が異なります。Appleの購入画面で金額をご確認ください。")
                    .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4)
            } else {
                Text("購入価格：\(product.displayPrice)")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
            }
        } else {
            Text("Appleの購入価格を取得しています。取得後に購入できます。")
                .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4)
        }
    }
}

struct MembershipActiveBanner: View {
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill").font(.title2)
            VStack(alignment: .leading, spacing: 5) {
                Text("継続鑑定をご利用中です").font(.headline)
                Text("MEMBER").font(.caption2.weight(.semibold)).tracking(2)
            }
            Spacer(minLength: 0)
        }.foregroundStyle(.white).padding(18)
            .background(FateTheme.ink, in: RoundedRectangle(cornerRadius: 16))
    }
}

private extension View {
    func membershipFeature() -> some View {
        font(.subheadline.weight(.medium))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(FateTheme.card.opacity(0.8), in: RoundedRectangle(cornerRadius: FLRadius.card))
            .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(FateTheme.line, lineWidth: 0.5))
    }
}
