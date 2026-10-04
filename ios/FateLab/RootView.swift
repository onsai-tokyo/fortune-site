import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @StateObject private var authPresentation = AuthPresentation.shared
    @StateObject private var tabRouter = AppTabRouter()
    @State private var showingSplash = true
    @State private var landingState: LandingState = .loading
    @State private var pendingInput: BirthInput?
    @AppStorage private var cachedConversationID: String
    @AppStorage private var onboardedUserID: String
    private let userID: UUID?

    init(userID: UUID? = nil) {
        self.userID = userID
        _cachedConversationID = AppStorage(wrappedValue: "", AccountStorage.key("landing.lastConversationID", userID: userID))
        _onboardedUserID = AppStorage(wrappedValue: "", AccountStorage.key("onboarding.completedUserID", userID: userID))
    }

    var body: some View {
        Group {
            if showingSplash || auth.state == .restoring {
                SplashView()
            } else if needsAuthentication {
                // A rejected refresh retains the account scope for recovery, so a
                // non-nil cached session alone does not authorize the main screen.
                AuthView(allowsDismissal: false, showsWelcome: true)
            } else if AppConfig.authenticationCheckOnly {
                authenticationCheckScreen
            } else {
                switch landingState {
                case .loading:
                    GeometryReader { geometry in
                    ScrollView { VStack(spacing: 12) {
                        FateLoadingView(title: "前回の続きを準備しています", detail: "保存した鑑定書を確認しています。")
                        SlowConnectionNotice().padding(.horizontal, 28)
                    }.frame(maxWidth: .infinity).frame(minHeight: geometry.size.height) }.scrollIndicators(.hidden)
                    }.background { FateLoadingBackground() }
                case .newUser:
                    if onboardedUserID != (auth.session?.user.id.uuidString ?? "") {
                        OnboardingView(userID: userID) { input in
                            pendingInput = input
                            tabRouter.openYourReading()
                            onboardedUserID = auth.session?.user.id.uuidString ?? ""
                        }
                    } else {
                        mainTabs(latestConversationID: nil, initialInput: pendingInput ?? restoredPendingInput)
                    }
                case .returning(let conversationID):
                    mainTabs(latestConversationID: conversationID, initialInput: nil)
                case .failed(let kind):
                    FLErrorState(kind: kind) { Task { await loadLandingState() } }
                        .padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas)
                }
            }
        }
        .sheet(isPresented: Binding(get: { !needsAuthentication && (auth.session == nil || auth.state == .reauthenticationRequired) && authPresentation.isPresented },
                                    set: { authPresentation.isPresented = $0 })) {
            AuthView()
        }
        .environmentObject(tabRouter)
        .task { try? await Task.sleep(for: .milliseconds(400)); withAnimation(.easeOut(duration: 0.22)) { showingSplash = false } }
        .task(id: AccountScope(auth)) { await loadLandingState() }
        .onChange(of: cachedConversationID) { _, value in
            if let id = UUID(uuidString: value) { landingState = .returning(id) }
        }
    }

    private var needsAuthentication: Bool {
        auth.state == .reauthenticationRequired || (AppConfig.requiresAuthentication && auth.session == nil)
    }

    private var authenticationCheckScreen: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("ログイン確認版").font(.title2)
            Text("ログイン済み: \(auth.session?.user.email ?? "メールアドレス非公開")")
            Text("既存サービスと同じ認証環境を使用しています。鑑定・相手登録・購入はこの版では利用できません。")
                .font(.subheadline).foregroundStyle(FateTheme.muted)
            Text("認証先: \(AppConfig.supabaseURL.host ?? "設定不明")")
            Text("Version \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"))")
            if let message = auth.noticeMessage { Text(message) }
            if let message = auth.errorMessage { Text(message).foregroundStyle(.red) }
            Button("セッションを再確認") {
                Task {
                    let owner = AccountScope(auth)
                    do {
                        _ = try await auth.validAccessToken(forceRefresh: true)
                        try owner.check(auth)
                        auth.noticeMessage = "セッションを確認しました。"
                    } catch { if owner.isCurrent(auth) { auth.errorMessage = userFacingMessage(error) } }
                }
            }.disabled(auth.isWorking)
            Button("ログアウト") { auth.signOut() }
        }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(FateTheme.canvas)
    }

    private func mainTabs(latestConversationID: UUID?, initialInput: BirthInput?) -> some View {
        TabView(selection: Binding(
            get: { tabRouter.selectedTab },
            set: { tabRouter.selectTab($0) }
        )) {
            ResettableTabStack(tab: .you) { YourReadingRootView(initialConversationID: latestConversationID, initialInput: initialInput) }
                .tabItem { Label { Text("あなた") } icon: { Image(systemName: "house").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.you)
            ResettableTabStack(tab: .couple) { PartnerProfilesView() }
                .tabItem { Label { Text("ふたり") } icon: { Image(systemName: "person.2").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.couple)
            ResettableTabStack(tab: .readings) { ReadingLibraryRootView() }
                .tabItem { Label { Text("本棚") } icon: { Image(systemName: "book").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.readings)
            ResettableTabStack(tab: .compose) { BookCreationRootView() }
                .tabItem { Label("鑑定書をつくる", systemImage: "square.and.pencil") }.tag(AppTab.compose)
            ResettableTabStack(tab: .settings) { SettingsView() }
                .tabItem { Label { Text("設定") } icon: { Image(systemName: "gearshape").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.settings)
        }
        .tint(FateTheme.ink)
        .background(FateTheme.canvas)
        .onAppear { tabRouter.selectInitialTabIfNeeded() }
    }

    private var restoredPendingInput: BirthInput? {
        let value = UserDefaults.standard.string(forKey: AccountStorage.key("onboarding.draft", userID: userID)) ?? ""
        return Data(base64Encoded: value).flatMap { try? JSONDecoder().decode(BirthInput.self, from: $0) }
    }

    private func loadLandingState() async {
        guard !AppConfig.authenticationCheckOnly else { return }
        // Restoration can publish a cached session before validating its refresh
        // token. Wait for that decision before fetching an account's landing data.
        await auth.restore()
        guard !Task.isCancelled else { return }
        let owner = AccountScope(auth)
        guard auth.session != nil, auth.state != .reauthenticationRequired else { landingState = .loading; return }
        if let cached = UUID(uuidString: cachedConversationID) {
            landingState = .returning(cached)
        } else {
            landingState = .loading
        }
        do {
            let status = try await APIClient.shared.status(auth: auth)
            guard !Task.isCancelled, owner.isCurrent(auth) else { return }
            if let conversationID = status.latestConversationID {
                cachedConversationID = conversationID.uuidString
                landingState = .returning(conversationID)
            } else {
                let readings = try await APIClient.shared.readings(auth: auth)
                guard !Task.isCancelled, owner.isCurrent(auth) else { return }
                if let saved = readings.first(where: { !$0.isChat && !$0.isCompatibility }) {
                    cachedConversationID = saved.id.uuidString
                    landingState = .returning(saved.id)
                } else {
                    cachedConversationID = ""
                    landingState = .newUser
                }
            }

            // StoreKit/App Store sync can wait on the App Store independently of the
            // reading status request. It must never block the post-login landing UI.
            Task { await purchases.sync(auth: auth) }
        } catch {
            guard !Task.isCancelled, owner.isCurrent(auth) else { return }
            if case .returning = landingState { return }
            landingState = .failed(errorStateKind(error))
        }
    }

    private enum LandingState {
        case loading
        case newUser
        case returning(UUID)
        case failed(FLErrorState.Kind)
    }
}

enum AppTab: Int, Hashable { case you, couple, readings, chat, settings, compose }

struct ResettableTabStack<Content: View>: View {
    @EnvironmentObject private var tabRouter: AppTabRouter
    let tab: AppTab
    @ViewBuilder let content: Content
    var body: some View {
        NavigationStack {
            content.id(tabRouter.resetToken(for: tab)).fateAppHeader()
        }
        // Keep the tab's navigation controller and bar alive when returning to
        // its root. Only the content's presentation state needs to be reset.
        .id(tab)
    }
}

private struct ReadingLibraryRootView: View {
    @EnvironmentObject private var tabRouter: AppTabRouter
    var body: some View {
        ReadingListView()
            .navigationDestination(isPresented: Binding(
                get: { tabRouter.chatConversationID != nil },
                set: { if !$0 { tabRouter.chatConversationID = nil } }
            )) {
                if let id = tabRouter.chatConversationID {
                    ReadingChatView(conversationID: id, contextTitle: tabRouter.chatContextTitle, draftQuestion: tabRouter.chatDraftQuestion)
                }
            }
    }
}

private struct YourReadingRootView: View {
    @EnvironmentObject private var tabRouter: AppTabRouter
    let initialConversationID: UUID?
    let initialInput: BirthInput?
    @State private var showsInput: Bool
    @State private var showsList = false

    init(initialConversationID: UUID?, initialInput: BirthInput?) {
        self.initialConversationID = initialConversationID
        self.initialInput = initialInput
        _showsInput = State(initialValue: initialConversationID == nil)
    }

    var body: some View {
        Group {
            if showsInput {
                HomeView(initialInput: initialInput, autoGenerate: initialInput != nil)
            } else if showsList {
                ReadingListView { showsInput = true; showsList = false }
            } else if let initialConversationID {
                SavedReadingView(conversationID: initialConversationID)
            } else {
                HomeView()
            }
        }
        .toolbar {
            if !showsInput, !showsList, initialConversationID != nil {
                ToolbarItem(placement: .topBarLeading) { Button("鑑定一覧") { showsList = true } }
                ToolbarItem(placement: .topBarTrailing) { Button("新しく鑑定") { showsInput = true } }
            }
        }
        .onChange(of: initialConversationID) { _, id in
            if id != nil { showsInput = false; showsList = false }
        }
        .onChange(of: tabRouter.yourRootResetToken) { _, _ in
            showsList = false
            showsInput = initialConversationID == nil
        }
    }
}

private struct SplashView: View {
    var body: some View { VStack(spacing: 22) { FateMark(size: 88); Text("FATE LAB").font(.system(size: 15, weight: .medium)).tracking(5) }.frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas.ignoresSafeArea()) }
}

@MainActor
final class AppTabRouter: ObservableObject {
    @Published var selectedTab: AppTab = .you
    private var hasPresentedTabs = false
    @Published private(set) var yourRootResetToken = 0
    @Published private var resetTokens: [AppTab: Int] = [:]
    @Published var chatConversationID: UUID?
    @Published var chatContextTitle: String?
    @Published var chatDraftQuestion: String?

    func selectInitialTabIfNeeded() {
        guard !hasPresentedTabs else { return }
        hasPresentedTabs = true
        selectedTab = .you
    }

    func selectTab(_ tab: AppTab) {
        if tab == selectedTab {
            resetTokens[tab, default: 0] += 1
            if tab == .you { yourRootResetToken += 1 }
        }
        selectedTab = tab
    }

    func resetToken(for tab: AppTab) -> Int { resetTokens[tab, default: 0] }

    func openYourReading() {
        selectedTab = .you
        resetTokens[.you, default: 0] += 1
        yourRootResetToken += 1
    }

    func openChat(conversationID: UUID, contextTitle: String? = nil, draftQuestion: String? = nil) {
        chatContextTitle = contextTitle
        chatDraftQuestion = draftQuestion
        chatConversationID = conversationID
        selectedTab = .readings
    }

    func closeMissingChat() {
        chatConversationID = nil
        chatContextTitle = nil
        chatDraftQuestion = nil
        selectedTab = .you
    }

    func showChatHistory() {
        chatConversationID = nil
        chatContextTitle = nil
        chatDraftQuestion = nil
        selectedTab = .readings
    }
}

private struct AIChatTabView: View {
    @EnvironmentObject private var tabRouter: AppTabRouter

    var body: some View {
        ChatHistoryRootView()
        .background(FateTheme.canvas)
        .navigationDestination(
            isPresented: Binding(
                get: { tabRouter.chatConversationID != nil },
                set: { isPresented in
                    if !isPresented {
                        tabRouter.chatConversationID = nil
                        tabRouter.chatContextTitle = nil
                        tabRouter.chatDraftQuestion = nil
                    }
                }
            )
        ) {
            if let conversationID = tabRouter.chatConversationID {
                ReadingChatView(conversationID: conversationID, contextTitle: tabRouter.chatContextTitle, draftQuestion: tabRouter.chatDraftQuestion)
                    .id(conversationID)
            }
        }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
