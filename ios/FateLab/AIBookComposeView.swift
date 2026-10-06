import SwiftUI
import StoreKit

struct AIBookComposeView: View {
    let readings: [ReadingSummary]
    var isTab = false
    var previewMode = false
    var sourcesLoading = false
    var sourcesError: String?
    var reloadSources: () -> Void = {}
    @EnvironmentObject private var tabRouter: AppTabRouter
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var sourceID: UUID?
    @State private var focusCardID: String?
    @State private var focusTitle: String?
    @State private var theme = "恋愛・関係"
    @State private var question = ""
    @State private var status: AIBookStatus?
    @State private var pending: PendingAIBook?
    @State private var accepted: AIBook?
    @State private var error: String?
    @State private var working = false
    @State private var recoveryBlocked = false
    private let themes = ["恋愛・関係", "仕事", "人間関係", "時期の判断", "その他"]
    private var valid: Bool { !recoveryBlocked && sourceID != nil && (20...400).contains(question.trimmingCharacters(in: .whitespacesAndNewlines).unicodeScalars.count) }
    private var pendingKey: String { AccountStorage.key("book.pending.v1", userID: auth.userID) }
    private var bodyJSON: [String: String] {
        var value = ["sourceId": sourceID?.uuidString ?? "", "theme": theme, "question": question.trimmingCharacters(in: .whitespacesAndNewlines)]
        if let focusCardID { value["focusCardId"] = focusCardID }
        return value
    }

    @State private var loadedOwner: AccountScope?
    @State private var showPlans = false
    @FocusState private var editingQuestion: Bool
    private var characters: Int { question.trimmingCharacters(in: .whitespacesAndNewlines).unicodeScalars.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if let accepted {
                    if accepted.isPending {
                        BookGenerationStatusView(state: accepted.state)
                    } else if accepted.state == "delivered" {
                        FateEditorialHero(eyebrow: "YOUR READING", title: "鑑定書が完成しました", subtitle: "あなたへの一冊を、本棚にお届けしました。")
                        NavigationLink { AIBookDetailView(initial: accepted) } label: { Text("完成した鑑定書を読む") }.buttonStyle(FLPrimaryButtonStyle())
                    } else {
                        Text("鑑定書を作成できませんでした").font(FateType.sectionTitle)
                        Text("利用枠をお戻ししました。相談内容をご確認のうえ、もう一度お試しください。").font(.subheadline).foregroundStyle(FateTheme.muted)
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(FateTheme.danger) }
                    Button("本棚で確認する") { if isTab { tabRouter.selectTab(.readings) } else { dismiss() } }.buttonStyle(FLSecondaryButtonStyle())
                    Button("別の相談を書く") { self.accepted = nil; question = ""; Task { await refresh() } }.buttonStyle(FLSecondaryButtonStyle())
                } else {
                    FateEditorialHero(eyebrow: "PERSONAL READING", title: "いまの想いを、\n一冊の鑑定書に。", subtitle: "あなたの相談と保存した鑑定から、約5,000文字で読み解きます。")
                    VStack(alignment: .leading, spacing: 16) {
                        composerLabel("01", "誰について相談しますか")
                        Picker("もとにする鑑定", selection: Binding(get: { sourceID }, set: { value in
                            if sourceID != value { focusCardID = nil; focusTitle = nil }; sourceID = value
                        })) {
                            Text("鑑定を選ぶ").tag(Optional<UUID>.none)
                            if let sourceID, !readings.contains(where: { $0.id == sourceID }) {
                                Text("選択した鑑定").tag(Optional(sourceID))
                            }
                            ForEach(readings) { Text($0.title.replacingOccurrences(of: "の相性", with: "について")).tag(Optional($0.id)) }
                        }.tint(FateTheme.ink).frame(maxWidth: .infinity, alignment: .leading)
                        if let focusTitle {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("この鑑定をもとに相談").font(.caption).foregroundStyle(FateTheme.muted)
                                Text(focusTitle).font(.subheadline)
                                Text("元の鑑定文と判定の根拠を踏まえて、相談に回答します。").font(.footnote).foregroundStyle(FateTheme.muted)
                            }.accessibilityIdentifier("book.focus")
                        }
                        if sourcesLoading && readings.isEmpty {
                            HStack(spacing: 8) { ProgressView(); Text("鑑定を確認しています") }.font(.caption).foregroundStyle(FateTheme.muted)
                        } else if let sourcesError {
                            Text(sourcesError).font(.footnote).foregroundStyle(FateTheme.danger)
                            Button("鑑定を再読み込み", action: reloadSources).font(.footnote)
                        } else if readings.isEmpty {
                            Text("「あなた」タブで基本の鑑定をつくると選べます。").font(.footnote).foregroundStyle(FateTheme.muted)
                        }
                    }.padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: FLRadius.card)).disabled(working || pending != nil)
                    VStack(alignment: .leading, spacing: 16) {
                        composerLabel("02", "相談のテーマ")
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(themes, id: \.self) { value in
                                Button { theme = value } label: {
                                    Text(value).font(.subheadline.weight(theme == value ? .semibold : .regular))
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                        .foregroundStyle(theme == value ? FateTheme.canvas : FateTheme.ink)
                                        .background(theme == value ? FateTheme.ink : FateTheme.card, in: Capsule())
                                }.buttonStyle(.plain).accessibilityAddTraits(theme == value ? .isSelected : [])
                            }
                        }
                    }.disabled(working || pending != nil)
                    VStack(alignment: .leading, spacing: 16) {
                        composerLabel("03", "気になっていることを、自由に")
                        ZStack(alignment: .topLeading) {
                            if question.isEmpty {
                                Text("今の状況、迷っていること、知りたいことを教えてください。")
                                    .font(.body).foregroundStyle(FateTheme.muted.opacity(0.65)).padding(.horizontal, 13).padding(.top, 17).allowsHitTesting(false)
                            }
                            TextEditor(text: $question).font(.body).lineSpacing(6).frame(minHeight: 190)
                                .padding(8).scrollContentBackground(.hidden).focused($editingQuestion)
                                .accessibilityLabel("相談したいこと。20文字から400文字")
                        }.background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
                        HStack {
                            Text("20〜400文字"); Spacer(); Text("\(characters) / 400").monospacedDigit()
                        }.font(.caption).foregroundStyle(characters > 400 ? FateTheme.danger : FateTheme.muted)
                        Text("例：同じことでパートナーとすれ違います。お互いの特徴を踏まえて、どんな伝え方を試せるでしょうか。")
                            .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
                    }.disabled(working || pending != nil)
                    if let pending {
                        Text("受付状況を確認しています。重複して利用枠を消費することはありません。").font(.footnote).foregroundStyle(FateTheme.muted)
                        Button("受付状況を確認・再送する") { Task { await submit(existing: pending) } }.buttonStyle(FLPrimaryButtonStyle()).disabled(working)
                        Button("受付がなければ入力に戻る") { Task { await releaseUnsubmitted() } }.disabled(working)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(FateTheme.danger)
                        Button("利用状況を再確認") { Task { await refresh() } }
                    }
                    DisclosureGroup("鑑定書について") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("月額会員は初月から毎月3通。単品購入もできます。作成した鑑定書は、解約後も本棚に残ります。")
                            Text("未使用の会員分は更新日に繰り越されません。単品購入分に期限はありません。生成に失敗した場合は利用枠をお戻しします。")
                            Text("計算結果と確認済みの原稿をもとにAIが構成します。健康・妊娠・生死、法律や投資の判断などは対象外です。")
                            HStack { Link("利用規約", destination: AppConfig.websiteBaseURL.appendingPathComponent("terms")); Link("プライバシー", destination: AppConfig.websiteBaseURL.appendingPathComponent("privacy")) }
                        }.font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5).padding(.top, 14)
                    }.font(.subheadline).tint(FateTheme.ink)
                }
            }.padding(.horizontal, FateSpacing.screenH).padding(.top, 12).padding(.bottom, 32)
        }.scrollDismissesKeyboard(.interactively)
        .refreshable { reloadSources(); await refresh() }
        .onChange(of: readings.map(\.id)) { _, ids in
            if sourceID == nil { sourceID = ids.first }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && !previewMode { Task { await refresh() } }
        }
        .background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if accepted == nil && pending == nil {
                VStack(spacing: 10) {
                    HStack {
                        Text(status.map { $0.enabled ? "利用できる鑑定書" : "現在、作成を休止しています" } ?? "利用枠を確認しています")
                        Spacer()
                        if let status, status.enabled { Text("残り \(status.remaining)通").fontWeight(.semibold).monospacedDigit() }
                    }.font(.caption).foregroundStyle(FateTheme.muted)
                    Button {
                        if previewMode { return }
                        editingQuestion = false
                        Task {
                            guard !working else { return }
                            let owner = AccountScope(auth)
                            working = true
                            let refreshed = await refreshMembership()
                            guard owner.isCurrent(auth) else { return }
                            working = false
                            guard refreshed else { return }
                            if (status?.remaining ?? 0) > 0 { await submit() } else { showPlans = true }
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if working { ProgressView().tint(.white) } else { Image(systemName: "sparkles") }
                            Text((status?.remaining ?? 0) > 0 ? "鑑定書をつくる · 1通分を使う" : "鑑定書をつくる")
                        }
                    }.buttonStyle(FLPrimaryButtonStyle()).disabled(!valid || working || status?.enabled != true)
                        .accessibilityIdentifier("book.create")
                    if status?.enabled == false {
                        Button("作成状況を更新") { Task { await refresh() } }.font(.footnote)
                    }
                    if characters < 20 { Text("相談を20文字以上入力すると作成できます。").font(.caption2).foregroundStyle(FateTheme.muted) }
                }.padding(.horizontal, FateSpacing.screenH).padding(.vertical, 14).background(FateTheme.canvas)
                    .overlay(alignment: .top) { Rectangle().fill(FateTheme.line).frame(height: 0.5) }
            }
        }
        .toolbar {
            if !isTab { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } }
            ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("入力を終える") { editingQuestion = false } }
        }
        .sheet(isPresented: $showPlans) { NavigationStack { purchaseOptions } }
        .task(id: accepted?.id) { await trackAccepted() }
        .task(id: AccountScope(auth)) {
#if DEBUG
            if previewMode {
                sourceID = readings.first?.id
                question = "仕事で頼まれごとを引き受けすぎてしまいます。自分のペースも大切にしながら、周囲と協力していくにはどうしたらよいでしょうか。"
                status = AIBookStatus(enabled: true, monthlyCredits: 3, remaining: 3, memberRemaining: 3, purchasedRemaining: 0, memberExpiresAt: nil, productId: "preview")
                return
            }
#endif
            let owner = AccountScope(auth)
            if loadedOwner != owner {
                accepted = nil; pending = nil; recoveryBlocked = false; status = nil; error = nil; sourceID = readings.first?.id
                focusCardID = nil; focusTitle = nil; question = ""; theme = "恋愛・関係"
                do {
                    if let data = try KeychainStore.readChecked(account: pendingKey) {
                        let saved = try JSONDecoder().decode(PendingAIBook.self, from: data)
                        pending = saved; sourceID = saved.sourceID; theme = saved.theme; question = saved.question; focusCardID = saved.focusCardID
                    }
                } catch { recoveryBlocked = true; self.error = "受付情報を読み込めませんでした。再購入せず、本棚をご確認ください。" }
                if pending == nil, !recoveryBlocked, isTab, let draft = tabRouter.bookDraft {
                    sourceID = draft.sourceID; theme = draft.theme
                    focusCardID = draft.cardID; focusTitle = draft.title
                    question = draft.title.map { "「\($0.prefix(120))」について、私の状況に合わせて詳しく知りたいです。" } ?? ""
                    tabRouter.bookDraft = nil
                }
                loadedOwner = owner
            }
            await refresh()
            await purchases.sync(auth: auth)
            do { try await purchases.syncBookMembership(auth: auth) } catch { self.error = userFacingErrorMessage(error) }
            await refresh()
        }
    }
    private func trackAccepted() async {
        guard let id = accepted?.id, !previewMode else { return }
        let owner = AccountScope(auth)
        while !Task.isCancelled && owner.isCurrent(auth) && accepted?.isPending == true {
            do {
                let result = try await APIClient.shared.bookCall(AIBookResponse.self, path: "/\(id.uuidString)", auth: auth)
                try owner.check(auth)
                guard let book = result.book else { error = "受付状況を確認できませんでした。本棚をご確認ください。"; return }
                accepted = book; error = nil
                if !book.isPending { await refresh(); return }
            } catch is CancellationError { return }
            catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
            do { try await Task.sleep(for: .seconds(8)) } catch { return }
        }
    }
    private func composerLabel(_ number: String, _ title: String) -> some View {
        HStack(spacing: 10) { Text(number).font(.caption.monospacedDigit()).foregroundStyle(FateTheme.muted); Text(title).font(.subheadline.weight(.medium)) }
    }
    private var purchaseOptions: some View {
        ScrollView { VStack(alignment: .leading, spacing: 22) {
            Text("一冊を、あなたの本棚に。").font(FateType.screenTitle)
            Text("入力した相談はそのまま残ります。利用枠の購入後に、作成ボタンを押してください。").font(.subheadline).foregroundStyle(FateTheme.muted)
            if let product = purchases.bookProduct {
                Button("鑑定書1通分 · \(product.displayPrice)") { Task { await buySingle(); if (status?.remaining ?? 0) > 0 { showPlans = false } } }.buttonStyle(FLPrimaryButtonStyle()).disabled(working || purchases.isWorking || purchases.isSyncing)
            } else { Button("料金情報を読み込む") { Task { await purchases.load() } }.buttonStyle(FLPrimaryButtonStyle()) }
            if !purchases.isPremium, !purchases.hasStoreKitEntitlement, purchases.accessState == .standard, let product = purchases.product {
                Text("初月から毎月3通つき").font(.headline)
                Text(ReadingPrices.monthly).font(.headline)
                StorePurchasePrice(product: product)
                Button("月額会員になる") { Task { await subscribe(); if (status?.remaining ?? 0) > 0 { showPlans = false } } }.buttonStyle(FLSecondaryButtonStyle()).disabled(working || purchases.isWorking || purchases.isSyncing)
            }
            if purchases.isPremium || purchases.hasStoreKitEntitlement {
                Text((status?.memberRemaining ?? 0) == 0 ? "会員分の利用枠がありません。購入済みの場合は、下のボタンから利用枠を再確認できます。" : "会員の利用枠を確認しました。")
                    .font(.subheadline).foregroundStyle(FateTheme.muted)
            }
            Button("購入を復元・利用枠を再確認") {
                Task {
                    working = true
                    await purchases.restore(auth: auth)
                    await refreshMembership()
                    working = false
                    if (status?.remaining ?? 0) > 0 { showPlans = false }
                }
            }.buttonStyle(FLSecondaryButtonStyle()).disabled(working || purchases.isWorking || purchases.isSyncing)
            if let message = purchases.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            Text("月額会員は1ヶ月ごとの自動更新です。解約はApple Accountのサブスクリプション設定から行えます。").font(.footnote).foregroundStyle(FateTheme.muted)
            HStack { Link("利用規約", destination: AppConfig.websiteBaseURL.appendingPathComponent("terms")); Link("プライバシー", destination: AppConfig.websiteBaseURL.appendingPathComponent("privacy")) }.font(.caption)
            if let error { Text(error).font(.footnote).foregroundStyle(FateTheme.danger) }
        }.padding(24) }.background(FateTheme.canvas).toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { showPlans = false } } }.task { await purchases.load() }
    }
    @discardableResult private func refreshMembership() async -> Bool {
        let owner = AccountScope(auth)
        await purchases.sync(auth: auth)
        do { try await purchases.syncBookMembership(auth: auth); try owner.check(auth) }
        catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
        return await refresh()
    }
    @discardableResult private func refresh() async -> Bool {
        let owner = AccountScope(auth)
        do {
            let updated = try await APIClient.shared.bookCall(AIBookStatus.self, path: "/status", auth: auth)
            try owner.check(auth)
            status = updated
            return true
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) }; return false }
    }
    private func validate() async throws {
        let result = try await APIClient.shared.bookCall(AIBookValidation.self, path: "/validate", method: "POST", json: bodyJSON, auth: auth)
        guard result.valid else { throw APIError.invalidResponse }
    }
    private func buySingle() async {
        let owner = AccountScope(auth)
        working = true; error = nil; defer { if owner.isCurrent(auth) { working = false } }
        do { try await validate(); try owner.check(auth); try await purchases.purchaseBook(auth: auth); try owner.check(auth); await refresh() }
        catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
    private func subscribe() async {
        let owner = AccountScope(auth)
        working = true; error = nil; defer { if owner.isCurrent(auth) { working = false } }
        do {
            try await validate(); try owner.check(auth)
            guard let id = auth.userID else { throw CancellationError() }
            await purchases.purchase(userID: id, auth: auth)
            try owner.check(auth)
            error = purchases.errorMessage
            await refresh()
        } catch { self.error = userFacingErrorMessage(error) }
    }
    private func releaseUnsubmitted() async {
        guard let pending else { return }
        let owner = AccountScope(auth), key = pendingKey
        working = true; defer { if owner.isCurrent(auth) { working = false } }
        do {
            let result = try await APIClient.shared.bookCall(AIBookResponse.self, path: "/operations/\(pending.operationID.uuidString)/cancel-unsubmitted", method: "POST", auth: auth)
            try owner.check(auth)
            if let book = result.book { accepted = book }
            // Server serializes cancellation with submission and records a tombstone before release.
            try KeychainStore.remove(account: key)
            self.pending = nil; error = nil
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }

    private func submit(existing: PendingAIBook? = nil) async {
        guard !working else { return }
        let owner = AccountScope(auth), key = pendingKey
        working = true; error = nil; defer { if owner.isCurrent(auth) { working = false } }
        do {
            let order: PendingAIBook
            if let existing { order = existing }
            else {
                try await validate(); try owner.check(auth)
                guard let sourceID else { throw APIError.invalidResponse }
                order = PendingAIBook(operationID: UUID(), sourceID: sourceID, theme: theme, question: question.trimmingCharacters(in: .whitespacesAndNewlines), focusCardID: focusCardID)
                try KeychainStore.save(JSONEncoder().encode(order), account: key)
                pending = order
            }
            let response = try await APIClient.shared.bookCall(AIBookResponse.self, path: "", method: "POST", json: order.body, auth: auth)
            try owner.check(auth)
            guard let book = response.book else { throw APIError.invalidResponse }
            // Remove only after an authoritative server acknowledgement.
            try KeychainStore.remove(account: key)
            pending = nil; accepted = book
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}
