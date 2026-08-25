import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @StateObject private var authPresentation = AuthPresentation.shared
    @StateObject private var tabRouter = AppTabRouter()
    @State private var showingSplash = true
    @State private var landingState: LandingState = .loading

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
                    mainTabs(latestConversationID: nil)
                case .returning(let conversationID):
                    mainTabs(latestConversationID: conversationID)
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
        .task { try? await Task.sleep(for: .seconds(1)); withAnimation(.easeOut(duration: 0.22)) { showingSplash = false } }
        .task(id: auth.session?.user.id) { await loadLandingState() }
    }

    private func mainTabs(latestConversationID: UUID?) -> some View {
        TabView(selection: Binding(
            get: { tabRouter.selectedTab },
            set: { tabRouter.selectTab($0) }
        )) {
            ResettableTabStack(tab: .you) { YourReadingRootView(initialConversationID: latestConversationID) }
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
        landingState = .loading
        do {
            let status = try await APIClient.shared.status(auth: auth)
            guard !Task.isCancelled else { return }
            if let conversationID = status.latestConversationID { landingState = .returning(conversationID) }
            else { landingState = .newUser }

            // StoreKit/App Store sync can wait on the App Store independently of the
            // reading status request. It must never block the post-login landing UI.
            Task { await purchases.sync(auth: auth) }
        } catch {
            guard !Task.isCancelled else { return }
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
    var body: some View { NavigationStack { content }.id(tabRouter.resetToken(for: tab)) }
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
    @State private var showsInput: Bool
    @State private var showsList = false

    init(initialConversationID: UUID?) {
        self.initialConversationID = initialConversationID
        _showsInput = State(initialValue: initialConversationID == nil)
    }

    var body: some View {
        Group {
            if showsInput {
                HomeView()
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

    func selectTab(_ tab: AppTab) {
        if tab == selectedTab {
            resetTokens[tab, default: 0] += 1
            if tab == .you { yourRootResetToken += 1 }
        }
        selectedTab = tab
    }

    func resetToken(for tab: AppTab) -> Int { resetTokens[tab, default: 0] }

    func openChat(conversationID: UUID, contextTitle: String? = nil) {
        chatConversationID = conversationID
        chatContextTitle = contextTitle
        selectedTab = .chat
    }

    func closeMissingChat() {
        chatConversationID = nil
        chatContextTitle = nil
        selectedTab = .you
    }

    func showChatHistory() {
        chatConversationID = nil
        chatContextTitle = nil
        selectedTab = .chat
    }
}

private struct AIChatTabView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter

    var body: some View {
        Group {
            if let conversationID = tabRouter.chatConversationID {
                VStack(spacing: 0) {
                    Text(tabRouter.chatContextTitle.map { "「\($0)」について質問できます" } ?? "")
                        .font(.caption).foregroundStyle(FateTheme.muted)
                        .padding(.horizontal, 14).padding(.vertical, tabRouter.chatContextTitle == nil ? 0 : 8)
                        .frame(maxWidth: .infinity)
                        .frame(height: tabRouter.chatContextTitle == nil ? 0 : nil)
                        .opacity(tabRouter.chatContextTitle == nil ? 0 : 1)
                    ReadingChatView(conversationID: conversationID)
                        .id(conversationID)
                }
            } else if auth.session == nil {
                ContentUnavailableView {
                    Label("対話", systemImage: "bubble.left.and.bubble.right")
                } description: {
                    Text("ログインすると、鑑定結果について質問できます。")
                } actions: {
                    Button("ログインする") { AuthPresentation.shared.isPresented = true }.buttonStyle(FLPrimaryButtonStyle())
                }
            } else {
                ReadingListView(chatsOnly: true)
            }
        }
        .background(FateTheme.canvas)
        .toolbar {
            if tabRouter.chatConversationID != nil {
                ToolbarItem(placement: .topBarLeading) {
                    Button("履歴") { tabRouter.showChatHistory() }
                }
            }
        }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
