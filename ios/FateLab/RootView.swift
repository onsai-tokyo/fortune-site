import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @StateObject private var authPresentation = AuthPresentation.shared
    @StateObject private var tabRouter = AppTabRouter()
    @State private var showingSplash = true
    @State private var landingState: LandingState = .loading
    @State private var pendingInput: BirthInput?
    @AppStorage("fatelab.landing.lastConversationID") private var cachedConversationID = ""
    @AppStorage("fatelab.onboarding.completedUserID") private var onboardedUserID = ""

    var body: some View {
        Group {
            if showingSplash {
                SplashView()
            } else if AppConfig.requiresAuthentication && auth.session == nil {
                AuthView(allowsDismissal: false)
            } else {
                switch landingState {
                case .loading:
                    ProgressView("鑑定書を確認しています…").tint(FateTheme.ink)
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas)
                case .newUser:
                    if onboardedUserID != (auth.session?.user.id.uuidString ?? "") {
                        OnboardingView { input in
                            onboardedUserID = auth.session?.user.id.uuidString ?? ""
                            pendingInput = input
                        }
                    } else {
                        mainTabs(latestConversationID: nil, initialInput: pendingInput)
                    }
                case .returning(let conversationID):
                    mainTabs(latestConversationID: conversationID, initialInput: nil)
                case .failed(let kind):
                    FLErrorState(kind: kind) { Task { await loadLandingState() } }
                        .padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas)
                }
            }
        }
        .sheet(isPresented: Binding(get: { auth.session == nil && authPresentation.isPresented },
                                    set: { authPresentation.isPresented = $0 })) {
            AuthView()
        }
        .environmentObject(tabRouter)
        .task { try? await Task.sleep(for: .milliseconds(400)); withAnimation(.easeOut(duration: 0.22)) { showingSplash = false } }
        .task(id: auth.session?.user.id) { await loadLandingState() }
    }

    private func mainTabs(latestConversationID: UUID?, initialInput: BirthInput?) -> some View {
        TabView(selection: Binding(
            get: { tabRouter.selectedTab },
            set: { tabRouter.selectTab($0) }
        )) {
            ResettableTabStack(tab: .you) { YourReadingRootView(initialConversationID: latestConversationID, initialInput: initialInput) }
                .tabItem { Label { Text("あなた") } icon: { Image(systemName: "person").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.you)
            ResettableTabStack(tab: .couple) { PartnerProfilesView() }
                .tabItem { Label { Text("ふたり") } icon: { Image(systemName: "person.2").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.couple)
            ResettableTabStack(tab: .readings) { ReadingLibraryRootView() }
                .tabItem { Label { Text("鑑定書") } icon: { Image(systemName: "books.vertical").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.readings)
            ResettableTabStack(tab: .chat) { AIChatTabView() }
                .tabItem { Label { Text("対話") } icon: { Image(systemName: "bubble.left.and.bubble.right").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.chat)
            ResettableTabStack(tab: .settings) { SettingsView() }
                .tabItem { Label { Text("設定") } icon: { Image(systemName: "gearshape").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(AppTab.settings)
        }
        .tint(FateTheme.ink)
        .background(FateTheme.canvas)
    }

    private func loadLandingState() async {
        guard auth.session != nil else { landingState = .loading; return }
        if case .loading = landingState, let cached = UUID(uuidString: cachedConversationID) {
            landingState = .returning(cached)
        } else {
            landingState = .loading
        }
        do {
            let status = try await APIClient.shared.status(auth: auth)
            guard !Task.isCancelled else { return }
            if let conversationID = status.latestConversationID {
                cachedConversationID = conversationID.uuidString
                landingState = .returning(conversationID)
            } else {
                cachedConversationID = ""
                landingState = .newUser
            }

            // StoreKit/App Store sync can wait on the App Store independently of the
            // reading status request. It must never block the post-login landing UI.
            Task { await purchases.sync(auth: auth) }
        } catch {
            guard !Task.isCancelled else { return }
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

enum AppTab: Int, Hashable { case you, couple, readings, chat, settings }

private struct ResettableTabStack<Content: View>: View {
    @EnvironmentObject private var tabRouter: AppTabRouter
    let tab: AppTab
    @ViewBuilder let content: Content
    var body: some View { NavigationStack { content.fateAppHeader() }.id(tabRouter.resetToken(for: tab)) }
}

private struct ReadingLibraryRootView: View {
    @State private var showNewReading = false
    var body: some View {
        ReadingListView { showNewReading = true }
            .navigationDestination(isPresented: $showNewReading) { HomeView() }
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
    @Published private(set) var yourRootResetToken = 0
    @Published private var resetTokens: [AppTab: Int] = [:]
    @Published var chatConversationID: UUID?
    @Published var chatContextTitle: String?
    @Published var chatDraftQuestion: String?

    func selectTab(_ tab: AppTab) {
        if tab == selectedTab {
            resetTokens[tab, default: 0] += 1
            if tab == .you { yourRootResetToken += 1 }
        }
        selectedTab = tab
    }

    func resetToken(for tab: AppTab) -> Int { resetTokens[tab, default: 0] }

    func openChat(conversationID: UUID, contextTitle: String? = nil, draftQuestion: String? = nil) {
        chatConversationID = conversationID
        chatContextTitle = contextTitle
        chatDraftQuestion = draftQuestion
        selectedTab = .chat
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
        selectedTab = .chat
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
