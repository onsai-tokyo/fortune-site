import SwiftUI

private struct ReadingScrollKey: EnvironmentKey {
    static let defaultValue: @MainActor @Sendable (String) -> Void = { _ in }
}
private extension EnvironmentValues {
    var scrollToReading: @MainActor @Sendable (String) -> Void {
        get { self[ReadingScrollKey.self] }
        set { self[ReadingScrollKey.self] = newValue }
    }
}

struct ReadingScrollView<Content: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ViewBuilder var content: () -> Content
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                content().environment(\.scrollToReading, { id in
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.3)) {
                        proxy.scrollTo(id, anchor: .top)
                    }
                })
            }
        }
    }
}

private struct ReadingJumpMenu: View {
    @Environment(\.scrollToReading) private var scroll
    let cards: [ReadingCard]
    var prepare: (ReadingCard) -> Void = { _ in }
    var body: some View {
        if !cards.isEmpty {
            Menu {
                ForEach(cards) { card in
                    Button(card.navigationLabel) {
                        prepare(card)
                        Task { @MainActor in
                            await Task.yield()
                            scroll(card.id)
                        }
                    }
                }
            } label: {
                HStack {
                    Text("鑑定を選んで移動")
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down").font(.caption)
                }.font(.subheadline).foregroundStyle(FateTheme.ink)
                    .padding(16).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line))
            }
        }
    }
}

private struct ReadingConversationKey: EnvironmentKey { static let defaultValue: UUID? = nil }
private extension EnvironmentValues {
    var readingConversationID: UUID? {
        get { self[ReadingConversationKey.self] }
        set { self[ReadingConversationKey.self] = newValue }
    }
}


struct InsightHubView: View {
    enum Scope { case `self`, couple }
    let report: GeneratedReport
    var scope: Scope = .self
    let onQuestion: (ReadingCard) -> Void
    var onReload: (() -> Void)? = nil
    var isPartner = false
    @State private var selectedTab = "essence"

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            FateEditorialHero(eyebrow: scope == .couple ? "RELATIONSHIP" : "YOUR READING", title: scope == .couple ? "二人の関係性" : isPartner ? "あの人の取扱説明書" : "あなたの取扱説明書", subtitle: scope == .couple ? "二人の違いと重なりから、関係を見つめる。" : "自分らしさと、これからの流れを。")

            ScrollView(.horizontal) { HStack(spacing: 4) {
                ForEach(scope == .couple ? ["partner", "essence", "timing", "chart"] : ["essence", "timing", "chart"], id: \.self) { tab in
                    Button { selectedTab = tab } label: {
                        Text(tab == "partner" ? "あの人について" : tab == "essence" ? (scope == .couple ? "二人の関係" : isPartner ? "あの人の本質" : "あなたの本質") : tab == "timing" ? (scope == .couple ? "二人の節目" : "時期の流れ") : "命式詳細")
                            .font(.subheadline.weight(selectedTab == tab ? .semibold : .regular))
                            .fixedSize(horizontal: true, vertical: false).padding(.horizontal, 14).frame(minHeight: 44)
                            .foregroundStyle(selectedTab == tab ? FateTheme.ink : FateTheme.muted)
                            .background(selectedTab == tab ? FateTheme.card : .clear, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
                }
            }.padding(5).background(FateTheme.surface.opacity(0.75), in: RoundedRectangle(cornerRadius: 16)) }.scrollIndicators(.hidden)

            if selectedTab == "partner", let id = report.conversationID {
                PartnerReadingView(conversationID: id).id(id)
            } else if selectedTab == "chart" {
                if scope == .couple {
                    CoupleChartDetailsView(sections: report.chartSections, partnerName: "相手")
                } else {
                    ChartDetailsView(report: report, onQuestion: onQuestion, onReload: onReload)
                }
            } else {
                let cards = report.cards.filter {
                    $0.resolvedTab == selectedTab && $0.scope == (scope == .couple ? "couple" : "self")
                }
                if scope == .couple, selectedTab == "timing" {
                    CoupleTimingList(cards: cards, conversationID: report.conversationID, onQuestion: onQuestion)
                } else if scope == .self, selectedTab == "timing" {
                    SelfTimingList(cards: cards, conversationID: report.conversationID, onQuestion: onQuestion)
                        .id(report.conversationID)
                } else {
                    ReadingCardList(cards: cards, onQuestion: onQuestion)
                }
            }
        }
        .padding(.vertical, FateSpacing.screenH).background(FateTheme.canvas)
        .environment(\.readingConversationID, report.conversationID)
    }

    private func relationshipOrb(_ color: Color) -> some View {
        Circle().fill(RadialGradient(colors: [.white, color.opacity(0.65), color], center: .init(x: 0.35, y: 0.25), startRadius: 0, endRadius: 95))
            .overlay(FateMark(size: 38, color: .white.opacity(0.9)))
            .frame(width: 96, height: 96)
    }
}

private struct ChartDetailsView: View {
    let report: GeneratedReport
    let onQuestion: (ReadingCard) -> Void
    let onReload: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            FLSectionHeader(title: "命式の詳細")
            VStack(alignment: .leading, spacing: 5) {
                if let date = report.birthData["birthDate"] as? String { Text(date.replacingOccurrences(of: "-", with: "/") + " 生") }
                if let place = report.birthData["birthplace"] as? String { Text(place) }
                if let gender = report.birthData["gender"] as? String { Text(gender == "female" ? "女性" : "男性") }
            }.font(.footnote).foregroundStyle(FateTheme.muted)
            if report.chartSections.isEmpty {
                if let onReload {
                    FLErrorState(title: "命式データを読み込めませんでした", message: "通信状態を確認して、もう一度読み込んでください。", retry: onReload)
                } else {
                    FLEmptyState(title: "命式データがありません", message: "この鑑定では命式の詳細を表示できません。")
                }
            } else {
                ForEach(report.chartSections) { section in
                    ChartSectionView(section: section)
                }
            }
        }
        .padding(FateSpacing.cardPadding).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.canvas)
        .clipShape(RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }
}

struct ChartSectionView: View {
    let section: ChartSection
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(section.system).font(.caption).tracking(2).foregroundStyle(FateTheme.muted)
                Text(section.title).font(.title3.weight(.medium)).foregroundStyle(FateTheme.ink)
            }
            if let table = section.table { ChartTableView(table: table) }
            if let bars = section.bars { ChartBarsView(bars: bars) }
            if let grid = section.grid { ChartGridView(items: grid) }
            if let list = section.list { ChartListView(items: list) }
            if let note = section.note { Text(note).font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4) }
        }
        .padding(20).background(FateTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: FLRadius.card))
        .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(FateTheme.line, lineWidth: 0.5))
    }
}

private struct ChartTableView: View {
    let table: ChartTable
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 10) {
                GridRow { ForEach(Array(table.headers.enumerated()), id: \.offset) { _, value in Text(value).font(.caption).foregroundStyle(FateTheme.muted) } }
                Divider().gridCellUnsizedAxes(.horizontal)
                ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
                    GridRow { ForEach(Array(row.enumerated()), id: \.offset) { _, value in Text(value).font(.footnote).fixedSize() } }
                }
            }
        }
    }
}

private struct ChartBarsView: View {
    let bars: [ChartBar]
    var body: some View {
        VStack(spacing: 11) {
            ForEach(bars) { bar in
                HStack(spacing: 10) {
                    Text(bar.label).font(.system(size: 14, weight: .medium)).frame(width: 22)
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(FateTheme.line)
                            Capsule().fill(bar.isZero ? FateTheme.muted : FateTheme.ink).frame(width: bar.isZero ? 3 : geometry.size.width * CGFloat(bar.value / max(1, bar.max)))
                        }
                    }.frame(height: 7)
                    Text(bar.isZero ? "0  要補完" : String(format: "%.1f", bar.value)).font(.caption).foregroundStyle(bar.isZero ? FateTheme.danger : FateTheme.body).frame(width: 58, alignment: .trailing)
                }
            }
        }
    }
}

private struct ChartGridView: View {
    @Environment(\.dynamicTypeSize) private var textSize
    let items: [ChartGridItem]
    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: textSize.isAccessibilitySize ? 1 : 2), spacing: 10) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.position).font(.caption).foregroundStyle(FateTheme.muted)
                    Text(item.value).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading).padding(12)
                    .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

private struct ChartListView: View {
    let items: [ChartListItem]
    var body: some View {
        VStack(spacing: 0) {
            ForEach(items) { item in
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.label).font(.caption).foregroundStyle(FateTheme.muted)
                        if let note = item.note { Text(note).font(.caption2).foregroundStyle(FateTheme.muted) }
                    }
                    Spacer(); Text(item.value).font(.subheadline.weight(.medium)).multilineTextAlignment(.trailing)
                }.padding(.vertical, 10).overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line), alignment: .bottom)
            }
        }
    }
}

struct ReadingCardList: View {
    @Environment(\.isPartnerReading) private var isPartnerReading
    @Environment(\.readingConversationID) private var conversationID
    @EnvironmentObject private var auth: AuthStore
    @State private var selectedPaidCard: ReadingCard?
    @State private var resolvedCards: [String: ReadingCard] = [:]
    @StateObject private var purchaseNavigation = ReadingPurchaseNavigation()
    @State private var reader: ReadingCard?
    @State private var showReader = false
    @State private var openingID: String?
    @State private var accessError: String?
    @State private var preparedAccess: ReadingAccessResponse?
    @State private var readerGrant: ReadingAccessGrant?
    let cards: [ReadingCard]
    let onQuestion: (ReadingCard) -> Void
    var showsJumpMenu = true

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
        if showsJumpMenu { ReadingJumpMenu(cards: cards) }
        ForEach(Array(cards.enumerated()), id: \.element.id) { index, original in
            let item = resolvedCards[original.id] ?? original
            Button {
                Task { await open(item) }
            } label: {
                InsightCard(item: item, artworkIndex: index).contentShape(Rectangle())
                    .overlay(alignment: .bottomTrailing) {
                        if openingID == item.id { ProgressView().padding(20).background(.regularMaterial, in: Circle()).padding(12) }
                    }
            }.buttonStyle(.plain).id(item.id)
                .disabled(openingID != nil)
                .accessibilityHint(item.showsReadingLock ? "購入方法を表示します" : "鑑定の詳細を開きます")
        }
        }
        .sheet(item: $selectedPaidCard, onDismiss: {
            // Read the current handoff from a stable reference: the sheet's
            // dismissal closure can belong to a render before purchase completed.
            guard let grant = purchaseNavigation.consume(owner: AccountScope(auth), conversationID: conversationID) else { return }
            Task { @MainActor in
                await Task.yield()
                guard grant.owner.isCurrent(auth) else { return }
                readerGrant = grant
                reader = grant.card
                showReader = true
            }
        }) { item in
            ReadingUnlockSheet(item: item, conversationID: conversationID, initialAccess: preparedAccess) { card in
                resolvedCards[card.id] = card
                purchaseNavigation.stage(ReadingAccessGrant(card: card, conversationID: conversationID, owner: AccountScope(auth)))
                selectedPaidCard = nil
            }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .navigationDestination(isPresented: $showReader) {
            if let reader {
                FocusReadingView(item: reader, onQuestion: { onQuestion(reader) }, initialGrant: readerGrant)
                    .environment(\.isPartnerReading, isPartnerReading)
                    .environment(\.readingConversationID, conversationID)
            }
        }
        .onChange(of: AccountScope(auth)) { _, _ in
            selectedPaidCard = nil; purchaseNavigation.clear(); reader = nil
            showReader = false; resolvedCards.removeAll()
            openingID = nil; preparedAccess = nil; readerGrant = nil; accessError = nil
        }
        .alert("鑑定を開けませんでした", isPresented: Binding(get: { accessError != nil }, set: { if !$0 { accessError = nil } })) {
            Button("閉じる", role: .cancel) { accessError = nil }
        } message: { Text(accessError ?? "") }
    }

    private func open(_ card: ReadingCard) async {
        guard openingID == nil else { return }
        readerGrant = nil
        guard card.paidReadingLabel != nil || card.showsReadingLock else {
            reader = card; showReader = true; return
        }
        guard let conversationID else { accessError = "鑑定を保存してから開き直してください。"; return }
        let owner = AccountScope(auth)
        openingID = card.id
        defer { if owner.isCurrent(auth) { openingID = nil } }
        do {
            // Keep the list on screen until the authoritative result is ready.
            // Root already syncs StoreKit; do not repeat the full history on every tap.
            let result = try await APIClient.shared.readingAccess(target: .init(conversationId: conversationID, cardId: card.id), auth: auth)
            try owner.check(auth)
            if result.unlocked == true, let readable = result.card, readable.access?.locked == false {
                readerGrant = ReadingAccessGrant(card: readable, conversationID: conversationID, owner: owner)
                reader = readable; showReader = true
            } else if !result.enabled {
                reader = card; showReader = true
            } else {
                preparedAccess = result; selectedPaidCard = card
            }
        } catch { if owner.isCurrent(auth) { accessError = userFacingErrorMessage(error) } }
    }
}

/// Retains a completed purchase across sheet renders and consumes it exactly once.
@MainActor
final class ReadingPurchaseNavigation: ObservableObject {
    private var pending: ReadingAccessGrant?

    func stage(_ grant: ReadingAccessGrant) { pending = grant }
    func clear() { pending = nil }
    func consume(owner: AccountScope, conversationID: UUID?) -> ReadingAccessGrant? {
        defer { pending = nil }
        guard let pending, owner.userID != nil, pending.owner == owner,
              conversationID != nil, pending.conversationID == conversationID,
              pending.card.access?.locked == false else { return nil }
        return pending
    }
}

/// Short-lived, in-memory handoff of a server response, never a persisted entitlement.
struct ReadingAccessGrant {
    let card: ReadingCard
    let conversationID: UUID?
    let owner: AccountScope
    var checkedAt = Date()
    func matches(cardID: String, conversationID: UUID?, owner: AccountScope, now: Date = Date()) -> Bool {
        self.owner == owner && self.conversationID == conversationID && conversationID != nil
            && card.id == cardID && card.access?.locked == false
            && now.timeIntervalSince(checkedAt) >= 0 && now.timeIntervalSince(checkedAt) < 30
    }
}

/// Prices and purchase availability come from StoreKit and the server.
private struct ReadingUnlockSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    let item: ReadingCard
    let conversationID: UUID?
    var initialAccess: ReadingAccessResponse? = nil
    let onUnlocked: (ReadingCard) -> Void
    @State private var state: ReadingAccessResponse?
    @State private var loading = false
    @State private var approvalPending = false
    @State private var confirmApprovalReset = false
    @State private var error: String?

    private var target: ReadingPurchaseTarget? {
        conversationID.map { ReadingPurchaseTarget(conversationId: $0, cardId: item.id) }
    }
    private var available: Bool { (state ?? initialAccess)?.enabled == true && (state ?? initialAccess)?.productId == AppConfig.cardProductID }
    private var busy: Bool { loading || purchases.isWorking || purchases.isSyncing }
    private var hasCredit: Bool { ((state ?? initialAccess)?.credits ?? 0) > 0 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 14) {
                        Label("もう一歩、深く知る", systemImage: "lock")
                            .font(.caption.weight(.medium)).tracking(1)
                        Text(item.paidReadingLabel ?? item.title)
                            .font(.system(.title2, design: .default, weight: .medium))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(item.title).font(.subheadline).lineSpacing(5)
                    }
                    .foregroundStyle(.white).padding(24)
                    .frame(maxWidth: .infinity, minHeight: 190, alignment: .leading)
                    .background {
                        ReadingNatureArtwork(index: item.isTiming ? 8 : 3)
                            .overlay(.black.opacity(0.55))
                    }.clipShape(RoundedRectangle(cornerRadius: 24))

                    if state?.unlocked == true {
                        Button("鑑定を読む") { finish() }.buttonStyle(FLPrimaryButtonStyle())
                    } else {
                        option(title: "この鑑定だけを読む",
                               price: hasCredit ? "購入済みの1件分を使えます" : ReadingPrices.card,
                               detail: item.isTiming ? "表示中の対象・1年分を購入。購入した年は、会員期間にかかわらず読み返せます。" : "この相手の、この項目を購入。会員期間にかかわらず読み返せます。") {
                            StorePurchasePrice(product: purchases.cardProduct)
                            Button(hasCredit ? "購入済みの1件分で読む" : "この鑑定を購入") { Task { await buySingle() } }
                                .buttonStyle(FLPrimaryButtonStyle())
                                .disabled(!available || busy || (approvalPending && !hasCredit) || (!hasCredit && purchases.cardProduct == nil))
                        }
                        option(title: "月額会員で、すべて読む",
                               price: ReadingPrices.monthly,
                               detail: "会員期間中は、相性の有料項目と2027年以降の時系列が見放題。相談鑑定書は毎月3通です。") {
                            StorePurchasePrice(product: purchases.product)
                            Button(purchases.membershipActionTitle) { Task { await buyMembership() } }
                                .buttonStyle(FLPrimaryButtonStyle())
                                .disabled(!available || busy || !purchases.canStartMembership)
                            Text("月額会員は自動更新です。解約はApp Storeのサブスクリプション管理から行えます。")
                                .font(.caption).foregroundStyle(FateTheme.muted).lineSpacing(4)
                        }
                    }
                    if approvalPending {
                        Text("Appleで購入の承認を待っています。承認後は「購入状況を確認」を押してください。")
                            .font(.footnote).foregroundStyle(FateTheme.muted)
                        Button("購入状況を確認") { Task { await refresh(sync: true) } }.disabled(busy)
                        Button("承認が見送られた場合") { confirmApprovalReset = true }.font(.caption).disabled(busy)
                    }
                    if busy { ProgressView().frame(maxWidth: .infinity).accessibilityLabel("購入手続き中") }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(FateTheme.danger).lineSpacing(5)
                        Button("購入状況を確認") { Task { await refresh(sync: true) } }
                            .disabled(busy)
                    } else if state?.enabled == false {
                        Text("購入機能を準備しています。この画面では課金されません。")
                            .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
                    }
                    if available {
                        Button("購入を復元") { Task {
                            await purchases.restore(auth: auth)
                            await refresh()
                        } }.font(.footnote).disabled(busy)
                    }
                    HStack(spacing: 24) {
                        Link("利用規約", destination: AppConfig.websiteBaseURL.appending(path: "/terms"))
                        Link("プライバシー", destination: AppConfig.websiteBaseURL.appending(path: "/privacy"))
                    }.font(.caption).foregroundStyle(FateTheme.muted)
                }.padding(24)
            }.background(FateTheme.canvas)
                .navigationTitle("鑑定をひらく").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() }.disabled(loading) } }
        }.alert("承認が見送られたことを確認しましたか？", isPresented: $confirmApprovalReset) {
            Button("確認したので再試行する") {
                do { try purchases.clearCardApprovalReminder(auth: auth); approvalPending = false }
                catch { self.error = userFacingErrorMessage(error) }
            }
            Button("承認を待つ", role: .cancel) {}
        } message: {
            Text("アプリ内の承認待ち表示を解除します。Appleへの申請自体は取り消されません。承認待ちが続いている場合は、再購入せずにお待ちください。")
        }.tint(FateTheme.ink).task(id: AccountScope(auth)) {
            if let initialAccess {
                state = initialAccess
                approvalPending = (try? purchases.cardApprovalIsPending(auth: auth)) ?? true
                if purchases.cardProduct == nil || purchases.product == nil { await purchases.load() }
                if purchases.accessState == .unknown { await purchases.sync(auth: auth) }
            } else { await refresh(sync: true) }
        }
    }

    private func finish() {
        guard state?.unlocked == true, let card = state?.card, card.access?.locked == false else { return }
        onUnlocked(card)
    }
    private func refresh(sync: Bool = false) async {
        guard let target else { error = "鑑定を保存してから開き直してください。"; return }
        let owner = AccountScope(auth)
        loading = true; error = nil; state = nil
        defer { if owner.isCurrent(auth) { loading = false } }
        do {
            if sync {
                await purchases.sync(auth: auth)
                if purchases.cardProduct == nil || purchases.product == nil { await purchases.load() }
            }
            try owner.check(auth)
            let result = try await APIClient.shared.readingAccess(target: target, auth: auth)
            try owner.check(auth); state = result
            if (result.credits ?? 0) > 0 { try purchases.clearCardApprovalReminder(auth: auth) }
            approvalPending = try purchases.cardApprovalIsPending(auth: auth)
            if result.unlocked == true { finish() }
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error); approvalPending = (try? purchases.cardApprovalIsPending(auth: auth)) ?? true } }
    }
    private func buySingle() async {
        guard let target, !busy, available else { return }
        let owner = AccountScope(auth)
        loading = true; error = nil
        defer { if owner.isCurrent(auth) { loading = false } }
        do {
            let result = try await purchases.purchaseCard(target: target, auth: auth)
            try owner.check(auth); state = result
            if (result.credits ?? 0) > 0 { try purchases.clearCardApprovalReminder(auth: auth) }
            approvalPending = try purchases.cardApprovalIsPending(auth: auth); finish()
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error); approvalPending = (try? purchases.cardApprovalIsPending(auth: auth)) ?? true } }
    }
    private func buyMembership() async {
        guard let id = auth.userID, !busy, available else { return }
        let owner = AccountScope(auth)
        await purchases.purchase(userID: id, auth: auth)
        guard owner.isCurrent(auth) else { return }
        let purchaseError = purchases.errorMessage
        await refresh()
        if state?.unlocked == true { finish() } else if let purchaseError { error = purchaseError }
    }
    private func option<Content: View>(title: String, price: String, detail: String, @ViewBuilder action: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline).foregroundStyle(FateTheme.ink)
            Text(price).font(.subheadline.weight(.medium)).foregroundStyle(FateTheme.ink)
            Text(detail).font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5)
            action()
        }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line))
    }
}

/// Recheck even previously downloaded paid cards before opening their body.
/// A membership flag or a cached unlock never authorizes this reader locally.
private struct ReadingAccessGuard: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.readingConversationID) private var conversationID
    @Environment(\.scenePhase) private var scenePhase
    let item: ReadingCard
    let onQuestion: () -> Void
    var initialGrant: ReadingAccessGrant? = nil
    @State private var usedInitialGrant = false
    @State private var readable: ReadingCard?
    @State private var locked = false
    @State private var error: String?

    var body: some View {
        Group {
            if let readable {
                ReadingDetailContent(item: readable, onQuestion: onQuestion)
            } else if !usedInitialGrant, let initialGrant,
                      initialGrant.matches(cardID: item.id, conversationID: conversationID, owner: AccountScope(auth)) {
                ReadingDetailContent(item: initialGrant.card, onQuestion: onQuestion)
            } else if locked {
                ReadingUnlockSheet(item: item, conversationID: conversationID) { readable = $0; locked = false }
            } else if let error {
                FLErrorState(title: "購入状況を確認できませんでした", message: error) { Task { await load() } }
            } else {
                FateInlineLoading(title: "鑑定を確認しています")
            }
        }
        .task(id: AccountScope(auth)) { await load() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { readable = nil } else { Task { await load() } }
        }
    }
    private func load() async {
        let owner = AccountScope(auth)
        if !usedInitialGrant {
            usedInitialGrant = true
            if let initialGrant, initialGrant.matches(cardID: item.id, conversationID: conversationID, owner: owner) {
                readable = initialGrant.card; return
            }
        }
        readable = nil; locked = false; error = nil
        guard let conversationID else { error = "鑑定を保存してから、開き直してください。"; return }
        do {
            let result = try await APIClient.shared.readingAccess(target: .init(conversationId: conversationID, cardId: item.id), auth: auth)
            try owner.check(auth)
            if !result.enabled { readable = item }
            else if result.unlocked == true, let card = result.card, card.access?.locked == false { readable = card }
            else { locked = true }
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

/// A single generated atlas supplies twelve distinct photographs. Cropping is
/// presentation only; no report value, ordering or evidence depends on artwork.
struct ReadingNatureArtwork: View {
    let index: Int
    private static let tiles: [UIImage] = {
        guard let source = UIImage(named: "ReadingNature")?.cgImage else { return [] }
        let width = source.width / 3, height = source.height / 4
        return (0..<12).compactMap { index in
            source.cropping(to: CGRect(x: (index % 3) * width, y: (index / 3) * height, width: width, height: height))
                .map { UIImage(cgImage: $0) }
        }
    }()
    var body: some View {
        GeometryReader { geometry in
            if !Self.tiles.isEmpty {
                Image(uiImage: Self.tiles[abs(index) % Self.tiles.count]).resizable().scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height).clipped()
            }
        }.accessibilityHidden(true).allowsHitTesting(false)
    }
}

/// Decorative redaction; unpaid text and tags never reach the device.
private struct LockedReadingPreview: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                ForEach([82.0, 106.0], id: \.self) { width in
                    Capsule().fill(FateTheme.muted.opacity(0.25)).frame(width: width, height: 25)
                }
            }
            RoundedRectangle(cornerRadius: 4).fill(FateTheme.muted.opacity(0.22)).frame(height: 10)
            RoundedRectangle(cornerRadius: 4).fill(FateTheme.muted.opacity(0.22)).frame(maxWidth: 210).frame(height: 10)
        }.blur(radius: 9).opacity(0.8).accessibilityHidden(true).allowsHitTesting(false)
    }
}

struct InsightCard: View {
    let item: ReadingCard
    var artworkIndex = 0

    var body: some View {
        if item.isTiming {
            HStack(alignment: .top, spacing: 14) {
                VStack(spacing: 0) {
                    Circle().stroke(FateTheme.muted.opacity(0.6), lineWidth: 1).frame(width: 7, height: 7)
                    Rectangle().fill(FateTheme.line).frame(width: 1)
                }.frame(width: 8).padding(.top, 25)
                VStack(alignment: .leading, spacing: 14) {
                    if item.scope == "couple" {
                        Text("二人の年運の比較").font(.caption).foregroundStyle(FateTheme.muted)
                    }
                    Text(item.displayPeriodLabel ?? "時期の流れ").font(.system(.title3, weight: .semibold))
                    Text(item.title).font(.body.weight(.medium)).lineSpacing(6)
                        .fixedSize(horizontal: false, vertical: true)
                    if item.showsReadingLock {
                        LockedReadingPreview()
                    } else {
                        TimelineTagList(tags: item.timelineDisplayTags)
                        Text(item.summary).font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5).lineLimit(3)
                    }
                    HStack { Spacer(); Label(item.showsReadingLock ? "単品購入／会員で読む" : "この年を読む", systemImage: item.showsReadingLock ? "lock" : "arrow.right").font(.caption) }
                        .foregroundStyle(FateTheme.muted)
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line.opacity(0.7), lineWidth: 0.5))
            }.foregroundStyle(FateTheme.ink)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Rectangle().fill(.white.opacity(0.65)).frame(width: 20, height: 1)
                    Text(item.navigationLabel)
                        .font(.subheadline.weight(.medium)).tracking(0.8)
                        .accessibilityAddTraits(.isHeader)
                }
                .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
                Spacer(minLength: 12)
                Text(item.title).font(.system(.headline, weight: .medium)).lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 12)
                HStack { Text(item.showsReadingLock ? "単品購入／会員で読む" : "読み進める").font(.caption); Spacer(); Image(systemName: item.showsReadingLock ? "lock" : "arrow.right") }
                    .padding(.top, 6)
            }.padding(24).frame(maxWidth: .infinity, minHeight: 220, alignment: .leading)
                .foregroundStyle(.white)
                .background {
                    ReadingNatureArtwork(index: artworkIndex)
                        .overlay(LinearGradient(colors: [.black.opacity(0.48), .black.opacity(0.24), .black.opacity(0.76)], startPoint: .top, endPoint: .bottom))
                }.clipShape(RoundedRectangle(cornerRadius: 22))
        }
    }
}

struct InsightDetailView: View {
    let item: ReadingCard
    let onQuestion: () -> Void
    @State private var focusMode = false

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Spacer()
            Text(item.title).font(.system(size: 32, weight: .bold)).lineSpacing(6)
            Text(item.summary).font(.system(size: 18)).foregroundStyle(FateTheme.body).lineSpacing(8)
            Spacer()
            Button("このページを読む →") { focusMode = true }.buttonStyle(FLPrimaryButtonStyle())
            DisclosureGroup("この読みの手がかり") { ForEach(item.evidence, id: \.detail) { Text($0.detail).font(.footnote).foregroundStyle(FateTheme.muted) } }.tint(FateTheme.ink)
        }.padding(28).background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $focusMode) { FocusReadingView(item: item, onQuestion: onQuestion) }
    }
}

struct FocusReadingView: View {
    let item: ReadingCard
    let onQuestion: () -> Void
    var initialGrant: ReadingAccessGrant? = nil
    var body: some View {
        if item.paidReadingLabel == nil {
            ReadingDetailContent(item: item, onQuestion: onQuestion)
        } else {
            ReadingAccessGuard(item: item, onQuestion: onQuestion, initialGrant: initialGrant)
        }
    }
}

/// The verified reader is a separate concrete view, avoiding a recursive
/// FocusReadingView -> ReadingAccessGuard -> FocusReadingView view hierarchy.
private struct ReadingDetailContent: View {
    @Environment(\.isPartnerReading) private var isPartnerReading
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @AccessibilityFocusState private var focusedAnchor: String?
    @ScaledMetric(relativeTo: .title) private var coverTitleSize = 24
    @ScaledMetric(relativeTo: .title3) private var sectionTitleSize = 20
    @ScaledMetric(relativeTo: .body) private var bodySize = 17
    let item: ReadingCard
    let onQuestion: () -> Void

    private enum ReaderStyle {
        static let paper = Color(red: 250 / 255.0, green: 248 / 255.0, blue: 245 / 255.0)
        static let ink = Color(red: 17 / 255.0, green: 17 / 255.0, blue: 17 / 255.0)
        static let body = Color(red: 74 / 255.0, green: 74 / 255.0, blue: 74 / 255.0)
        static let line = Color(red: 232 / 255.0, green: 227 / 255.0, blue: 221 / 255.0)
        static let lilac = Color(red: 214 / 255.0, green: 201 / 255.0, blue: 255 / 255.0)
        static let blush = Color(red: 249 / 255.0, green: 239 / 255.0, blue: 236 / 255.0)
    }

    private struct Chapter: Identifiable {
        let id: Int
        let title: String
        let body: String
        let role: String
        let section: ReadingCardSection?
        var anchor: String { "reader-chapter-\(id)" }
    }

    private var chapters: [Chapter] {
        if let sections = item.displaySections, !sections.isEmpty {
            return sections.enumerated().map { index, section in
                Chapter(id: index, title: section.heading, body: section.body, role: "section", section: section)
            }
        }
        // Preserve the original order and wording of older saved reports too.
        return item.displayPages.enumerated().map { index, page in
            Chapter(id: index, title: page.label, body: page.text, role: page.role, section: nil)
        }
    }

    private var hasMultipleChapters: Bool { chapters.count > 1 }

    var body: some View {
        readerBody
    }

    private var readerBody: some View {
        ScrollViewReader { proxy in
            VStack(spacing: 0) {
                readerHeader(proxy)
                ScrollView {
                    VStack(alignment: .leading, spacing: 32) {
                        VStack(alignment: .leading, spacing: 28) {
                            cover.id("reader-top")
                            ForEach(chapters) { chapter in
                                chapterView(chapter, proxy: proxy).id(chapter.anchor)
                            }
                        }
                        .padding(.horizontal, 24).padding(.top, 32).padding(.bottom, 36)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(alignment: .top) {
                            FateArtwork(name: "QuietMountains").frame(height: 160)
                                .mask(LinearGradient(colors: [.black.opacity(0.24), .clear], startPoint: .top, endPoint: .bottom))
                                .allowsHitTesting(false)
                        }
                        .background(ReaderStyle.paper)
                        .clipShape(RoundedRectangle(cornerRadius: FLRadius.card))
                        .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(ReaderStyle.line.opacity(0.7), lineWidth: 0.5))
                        .accessibilityIdentifier("reader.mountainSheet")
                        if !isPartnerReading { questionFooter }
                    }
                    .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 40)
                    .frame(maxWidth: 620, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .accessibilityIdentifier("reader.scroll")
            }
        }
        .background(ReaderStyle.paper.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .preferredColorScheme(.light)
    }

    private func readerHeader(_ proxy: ScrollViewProxy) -> some View {
        ZStack {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 15, weight: .medium))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }.accessibilityLabel("戻る").accessibilityIdentifier("reader.back")
                Spacer()

            }
            .buttonStyle(.plain)
            HStack(spacing: 7) {
                FateMark(size: 21, color: ReaderStyle.ink).accessibilityHidden(true)
                Text("FATE LAB").font(.system(size: 10, weight: .medium)).tracking(2.5)
            }.allowsHitTesting(false)
        }
        .foregroundStyle(ReaderStyle.ink)
        .padding(.horizontal, 12).padding(.vertical, 4)
        .background(ReaderStyle.paper)
    }

    private var cover: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(item.isTiming ? "時期の鑑定" : item.scope == "couple" ? "ふたりの鑑定" : isPartnerReading ? "あの人の鑑定" : "あなたの鑑定")
                .font(.caption.weight(.medium)).padding(.horizontal, 10).padding(.vertical, 6)
                .background(.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 5))
            Text(item.title).font(.system(size: coverTitleSize, weight: .medium))
                .lineSpacing(7).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            TimelineTagList(tags: item.timelineDisplayTags)
            if let summary = item.readerSummary { readerText(summary) }
            if let period = item.displayPeriodLabel {
                Text(period).font(.caption).foregroundStyle(ReaderStyle.body)
            }
        }
        .foregroundStyle(ReaderStyle.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 12)
        .overlay(FLDivider(), alignment: .bottom)
    }

    private func chapterView(_ chapter: Chapter, proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            if hasMultipleChapters {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        if item.isTiming {
                            Circle().fill(ReaderStyle.paper).frame(width: 10, height: 10)
                                .overlay(Circle().stroke(ReaderStyle.lilac, lineWidth: 2))
                                .accessibilityHidden(true)
                        }
                        Text(String(format: "%02d", chapter.id + 1))
                            .font(.subheadline).foregroundStyle(ReaderStyle.body.opacity(0.7))
                            .accessibilityHidden(true)
                    }
                    Text(chapter.title).font(.system(size: sectionTitleSize, weight: .semibold))
                        .foregroundStyle(ReaderStyle.ink).lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("reader.heading.\(chapter.id)")
                        .accessibilityFocused($focusedAnchor, equals: chapter.anchor)
                }
            }
            readerText(chapter.body)
            if !item.isTiming, let section = chapter.section {
                SectionEvidenceView(section: section)
                    .tint(ReaderStyle.body)
            }
            if hasMultipleChapters { chapterNavigation(chapter, proxy: proxy) }
        }
    }

    private func chapterNavigation(_ chapter: Chapter, proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 12) {
            Button {
                jump(to: chapter.id == 0 ? "reader-top" : "reader-chapter-\(chapter.id - 1)", proxy: proxy)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                    Text(chapter.id == 0 ? "最初へ" : "前の章へ")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(ReaderStyle.line.opacity(0.6), in: Capsule())
                .foregroundStyle(ReaderStyle.ink)
            }
            .accessibilityIdentifier("reader.previous.\(chapter.id)")
            Button {
                jump(to: chapter.id == chapters.last?.id ? "reader-question" : "reader-chapter-\(chapter.id + 1)", proxy: proxy)
            } label: {
                HStack(spacing: 6) {
                    Text(chapter.id == chapters.last?.id ? "質問へ" : "次の章へ")
                    Image(systemName: "chevron.right")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(ReaderStyle.ink, in: Capsule())
                .foregroundStyle(.white)
            }
            .accessibilityIdentifier("reader.next.\(chapter.id)")
        }
        .font(.subheadline.weight(.medium)).buttonStyle(.plain)
        .padding(.top, 4)
    }

    private var questionFooter: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("気になることを深掘り")
                .font(.headline).foregroundStyle(ReaderStyle.ink).accessibilityAddTraits(.isHeader)
                .accessibilityFocused($focusedAnchor, equals: "reader-question")
            Button { dismiss(); onQuestion() } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bubble.left").foregroundStyle(ReaderStyle.body)
                    Text("このことを聞いてみる")
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").font(.caption)
                }
                .font(.system(size: bodySize)).foregroundStyle(ReaderStyle.ink)
                .padding(16).frame(maxWidth: .infinity, minHeight: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ReaderStyle.line, lineWidth: 0.5))
            }
            .buttonStyle(.plain).accessibilityIdentifier("reader.question")
        }
        .padding(.top, 8).id("reader-question")
    }

    private func readerText(_ text: String) -> some View {
        Text(ReadingCard.readerDisplayText(text)).font(.system(size: bodySize)).foregroundStyle(ReaderStyle.body)
            .lineSpacing(7).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func jump(to anchor: String, proxy: ScrollViewProxy) {
        if reduceMotion || voiceOverEnabled { proxy.scrollTo(anchor, anchor: .top) }
        else { withAnimation(.easeInOut(duration: 0.25)) { proxy.scrollTo(anchor, anchor: .top) } }
        focusedAnchor = anchor
    }
}

struct TimelineTagList: View {
    let tags: [String]
    private func tagColor(_ tag: String) -> Color {
        if tag.contains("婚期") || tag.contains("結びつき") { return FateTheme.rose }
        if tag.contains("仕事") || tag.contains("活動") || tag.contains("進路") { return FateTheme.slate }
        if tag.contains("住まい") { return FateTheme.moss }
        if tag.contains("見直す") || tag.contains("揺れ") || tag.contains("分かれ道") { return FateTheme.ochre }
        return FateTheme.dusk
    }
    var body: some View {
        if !tags.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(FateTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(tagColor(tag).opacity(0.13), in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
    }
}

struct FlowTags: View {
    let tags: [String]
    var body: some View {
        HStack(spacing: 7) {
            ForEach(tags.prefix(4), id: \.self) { tag in
                Text("#\(tag)").font(.caption).foregroundStyle(FateTheme.ink).padding(.horizontal, 10).padding(.vertical, 6)
                    .background(FateTheme.ink.opacity(0.08)).clipShape(Capsule()).overlay(Capsule().stroke(FateTheme.line))
            }
        }
    }
}

struct SelfTimingList: View {
    @EnvironmentObject private var auth: AuthStore
    let cards: [ReadingCard]
    let conversationID: UUID?
    let onQuestion: (ReadingCard) -> Void
    @State private var refreshedCards: [ReadingCard]?
    @State private var eventReadings: [LifeEventReading] = []
    @State private var eventError: String?
    @State private var history: SelfTimingHistory?
    @State private var showAll = false
    @State private var loading = false
    @State private var error: String?

    private var allCards: [ReadingCard] {
        history.map { SelfTimingHistory.merging($0.cards, saved: refreshedCards ?? cards) } ?? (refreshedCards ?? cards).sorted { ($0.calendarYear ?? 0) < ($1.calendarYear ?? 0) }
    }
    private var visibleCards: [ReadingCard] {
        let start = Calendar(identifier: .gregorian).component(.year, from: Date()) - 5
        return showAll ? allCards : allCards.filter { $0.calendarYear.map { $0 >= start } ?? true }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            ReadingJumpMenu(cards: allCards) { card in
                if !visibleCards.contains(where: { $0.id == card.id }) { showAll = true }
            }
            if let eventError { Text(eventError).font(.footnote).foregroundStyle(FateTheme.muted); Button("年表を再読み込み") { Task { await refreshTimeline(forceCards: true) } } }

            if conversationID != nil || cards.contains(where: { ($0.calendarYear ?? Int.max) < Calendar(identifier: .gregorian).component(.year, from: Date()) - 5 }) {
                Button(showAll ? "以前の年を折りたたむ" : "6年以上前の年も見る（18歳以降）") {
                    Task { await toggleHistory() }
                }.buttonStyle(FLSecondaryButtonStyle()).disabled(loading)
                if loading { FateInlineLoading(title: "年の流れを読み込んでいます") }
                if let error { Text(error).font(.footnote).foregroundStyle(FateTheme.muted) }
                if showAll {
                    Text("出生情報から読んだ年ごとのテーマを表示しています。実際の出来事の記録ではありません。")
                        .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
                }
            }
            ForEach(visibleCards) { card in
                ReadingCardList(cards: [card], onQuestion: onQuestion, showsJumpMenu: false).id(card.id)
                if !card.showsReadingLock {
                    ForEach(eventReadings.filter { $0.year == card.calendarYear }) { reading in EventReadingView(reading: reading) }
                }
            }
        }.task(id: AccountScope(auth)) { await refreshTimeline() }
    }

    private func refreshTimeline(forceCards: Bool = false) async {
        guard let conversationID else { return }
        let owner = AccountScope(auth)
        do {
            async let readings = APIClient.shared.timelineCall(EventReadingsResponse.self, path: "/events/for-reading/" + conversationID.uuidString, auth: auth)
            // The parent already fetched the current cards. Refresh calculations
            // only after an edit, instead of requesting the same report twice.
            if forceCards {
                let result = try await APIClient.shared.cards(id: conversationID, auth: auth)
                try owner.check(auth)
                refreshedCards = result.cards.filter { $0.isTiming && $0.scope == "self" }
                history = nil
                if showAll { history = try await APIClient.shared.selfTimingHistory(id: conversationID, auth: auth) }
            }
            let events = try await readings
            try owner.check(auth); eventReadings = events.readings; eventError = nil
        } catch is CancellationError { }
        catch { if owner.isCurrent(auth) { eventError = userFacingErrorMessage(error) } }
    }

    private func toggleHistory() async {
        if showAll { showAll = false; return }
        if history != nil { showAll = true; return }
        guard !loading else { return }
        guard let conversationID else { showAll = true; return }
        let owner = AccountScope(auth)
        loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.selfTimingHistory(id: conversationID, auth: auth)
            try owner.check(auth)
            history = value; showAll = true
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "年の流れを追加できませんでした。表示中の年は引き続き読めます。もう一度お試しください。"
        }
    }
}

struct CoupleTimingList: View {
    @EnvironmentObject private var auth: AuthStore
    let cards: [ReadingCard]
    let conversationID: UUID?
    let onQuestion: (ReadingCard) -> Void
    @State private var history: CoupleAllYearsHistory?
    @State private var loadedConversationID: UUID?
    @State private var meetingYear = ""
    @State private var loading = false
    @State private var error: String?
    @State private var showPast = false
    @State private var openGroups: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("出会った年から、ふたりの流れを年ごとに読み解きます。")
                .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
            if let history {
                ReadingJumpMenu(cards: history.entries.compactMap(\.card)) { card in
                    if let year = card.calendarYear, history.collapsibleYears.contains(year) {
                        showPast = true
                        if let group = history.groups.first(where: { $0.years.contains(year) }) { openGroups.insert(group.from) }
                    }
                }
                if let note = history.relationshipContext?.note,
                   !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(note).font(.footnote).foregroundStyle(FateTheme.muted)
                        .lineSpacing(5).fixedSize(horizontal: false, vertical: true)
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 14))
                }
                if history.status == "needs_meeting_year" {
                    Text("相手のプロフィール画面で「出会った年」を設定すると、ふたりの時系列が表示されます。")
                        .font(.callout).foregroundStyle(FateTheme.muted)
                } else {
                    Text("\(history.meetingYear.map(String.init) ?? "")〜\(String(history.endYear))年・全\(history.entries.count)年")
                        .font(.caption).foregroundStyle(FateTheme.muted)
                    let collapsed = history.collapsibleYears
                    let hidden = Set(collapsed)
                    if hidden.isEmpty {
                        entries(history.entries)
                    } else {
                        entries(history.entries.filter { $0.year < (collapsed.first ?? 0) })
                        HStack {
                            Button("すべての年を開く") { showPast = true; openGroups = Set(history.groups.map(\.from)) }
                            Spacer()
                            Button("過去を折りたたむ") { showPast = false; openGroups.removeAll() }
                        }.font(.caption).frame(minHeight: 44)
                        DisclosureGroup(isExpanded: $showPast) {
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(history.groups.filter { !$0.years.filter { hidden.contains($0) }.isEmpty }, id: \.from) { group in
                                    DisclosureGroup(isExpanded: Binding(get: { openGroups.contains(group.from) }, set: { if $0 { openGroups.insert(group.from) } else { openGroups.remove(group.from) } })) {
                                        entries(history.entries.filter { group.years.contains($0.year) && hidden.contains($0.year) })
                                    } label: { Text("\(String(group.years.first(where: { hidden.contains($0) }) ?? group.from))〜\(String(group.to))年").font(.subheadline) }
                                }
                            }.padding(.top, 12)
                        } label: { Text("過去の鑑定を見る（\(collapsed.count)年分）").font(.subheadline) }
                        .tint(FateTheme.ink)
                        entries(history.entries.filter { $0.year > (collapsed.last ?? 0) })
                    }
                }
            }
            if loading { FateInlineLoading(title: "時系列を確認しています") }
            if let error {
                Text(error).font(.footnote).foregroundStyle(FateTheme.danger)
                if history == nil {
                    Button("もう一度確認") { Task { await load() } }.buttonStyle(FLSecondaryButtonStyle())
                    if !cards.isEmpty {
                        Text("保存済みの節目").font(.subheadline)
                        ReadingCardList(cards: cards, onQuestion: onQuestion)
                    }
                }
            }
        }.task(id: conversationID) { await load() }
    }
    @ViewBuilder private func entries(_ values: [CoupleAllYearsHistory.Entry]) -> some View {
        ForEach(values, id: \.year) { entry in
            if let label = entry.label { Text(label).font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted) }
            if let card = entry.card {
                ReadingCardList(cards: [card], onQuestion: onQuestion, showsJumpMenu: false).id(card.id)
            } else {
                Text("\(String(entry.year))年：この年の鑑定を表示できませんでした。")
                    .font(.callout).foregroundStyle(FateTheme.muted).padding(.vertical, 12)
            }
        }
    }
    private func receive(_ value: CoupleAllYearsHistory) {
        history = value; meetingYear = value.meetingYear.map(String.init) ?? ""
        showPast = false; openGroups.removeAll()
    }
    private func load() async {
        if history != nil && loadedConversationID == conversationID { return }
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--timeline-tags91-preview"),
           let value = try? JSONDecoder().decode(CoupleAllYearsHistory.self, from: TimelinePreview91.coupleData) {
            receive(value); return
        }
        if ProcessInfo.processInfo.arguments.contains("--couple-timeline-preview"),
           let url = Bundle.main.url(forResource: "couple-preview", withExtension: "json"),
           let bytes = try? Data(contentsOf: url),
           let value = try? JSONDecoder().decode(CoupleAllYearsHistory.self, from: bytes) {
            receive(value); return
        }
#endif
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--couple-timeline-preview") {
            let entries = (2010...2035).map { year in
                CoupleAllYearsHistory.Entry(year: year, label: year == 2010 ? "出会った年" : nil, contentStatus: "ready", card: ReadingCard(id: "preview-\(year)", kind: "timing", tab: "timing", scope: "couple", title: "小さな約束を重ね、ふたりの時間を整える年", summary: "表示確認用の架空原稿です。", tags: ["時期"], period: ReadingCardPeriod(label: "\(year)年"), pages: [ReadingCardPage(role: "core", label: "ふたりの流れ", text: "これは表示確認用のサンプルです。お互いのペースを確かめながら、日々の予定や約束を整えていきます。", note: nil)], sections: nil, evidence: []))
            }
            receive(CoupleAllYearsHistory(status: "ready", meetingYear: 2010, referenceYear: 2026, endYear: 2035, minMeetingYear: 1990, collapsedYears: Array(2011...2020), groups: [.init(from: 2011, to: 2015, years: Array(2011...2015)), .init(from: 2016, to: 2020, years: Array(2016...2020))], entries: entries)); return
        }
#endif
        guard let conversationID else { error = "保存済みの鑑定書から開いてください。"; return }
        let owner = AccountScope(auth)
        history = nil; loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.coupleAllYears(id: conversationID, auth: auth)
            try owner.check(auth); guard !Task.isCancelled else { return }
            loadedConversationID = conversationID
            receive(value)
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "時系列を取得できませんでした。時間をおいて再試行してください。"
        }
    }
    private func save() async {
        guard let conversationID, let history, !loading else { return }
        let raw = meetingYear.trimmingCharacters(in: .whitespacesAndNewlines)
        let year = Int(raw)
        if !raw.isEmpty && (raw.range(of: #"^[0-9]{4}$"#, options: .regularExpression) == nil || year == nil || year! < history.minMeetingYear || year! > history.referenceYear) {
            error = "出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。"; return
        }
        let owner = AccountScope(auth)
        loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.saveCoupleMeetingYear(id: conversationID, meetingYear: raw.isEmpty ? nil : year, auth: auth)
            try owner.check(auth); guard !Task.isCancelled else { return }
            loadedConversationID = conversationID
            receive(value)
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "保存結果を確認できませんでした。同じ年でもう一度保存してください。"
        }
    }
}

struct PartnerReadingView: View {
    let conversationID: UUID
    @EnvironmentObject private var auth: AuthStore
    @State private var report: GeneratedReport?
    @State private var error: String?
    @State private var loadedOwner: AccountScope?
    var body: some View {
        Group {
            if let report {
                PartnerEssenceContent(report: report)
            } else if let error {
                FLErrorState(title: "あの人の鑑定を読み込めませんでした", message: error) { Task { await load() } }
            } else { FateInlineLoading(title: "あの人の鑑定を開いています") }
        }.task(id: AccountScope(auth)) {
            if loadedOwner != AccountScope(auth) { report = nil; await load() }
        }
    }
    private func load() async {
        let owner = AccountScope(auth)
        do {
            let result = try await APIClient.shared.partnerReading(id: conversationID, auth: auth)
            try owner.check(auth)
            report = GeneratedReport(birthData: [:], calculatedData: [:], text: result.reportText, cards: result.cards, chartSections: result.chartSections ?? [])
            loadedOwner = owner; error = nil
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

/// The outer relationship hub already owns the banner and tabs.
struct PartnerEssenceContent: View {
    let report: GeneratedReport
    var body: some View {
        ReadingCardList(cards: report.cards.filter { $0.resolvedTab == "essence" && $0.scope == "self" }, onQuestion: { _ in })
            .environment(\.isPartnerReading, true)
    }
}

private struct PartnerReadingEnvironmentKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var isPartnerReading: Bool {
        get { self[PartnerReadingEnvironmentKey.self] }
        set { self[PartnerReadingEnvironmentKey.self] = newValue }
    }
}
