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
            NavigationStack { YourReadingRootView(initialConversationID: latestConversationID) }
                .tabItem { Label { Text("あなた") } icon: { Image(systemName: "person").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(0)
            NavigationStack { PartnerProfilesView() }
                .tabItem { Label { Text("ふたり") } icon: { Image(systemName: "person.2").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(1)
            NavigationStack { AIChatTabView() }
                .tabItem { Label { Text("対話") } icon: { Image(systemName: "bubble.left.and.bubble.right").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(2)
            NavigationStack { SettingsView() }
                .tabItem { Label { Text("設定") } icon: { Image(systemName: "gearshape").symbolVariant(.none).symbolRenderingMode(.monochrome) } }.tag(3)
        }
        .tint(FateTheme.ink)
        .background(FateTheme.canvas)
    }

    private func loadLandingState() async {
        guard auth.session != nil else { landingState = .loading; return }
        landingState = .loading
        await purchases.sync(auth: auth)
        do {
            let status = try await APIClient.shared.status(auth: auth)
            if let conversationID = status.latestConversationID { landingState = .returning(conversationID) }
            else { landingState = .newUser }
        } catch {
            guard userFacingMessage(error) != nil else { return }
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
    @Published var selectedTab = 0
    @Published private(set) var yourRootResetToken = 0
    @Published var chatConversationID: UUID?
    @Published var chatContextTitle: String?

    func selectTab(_ tab: Int) {
        if tab == 0 { yourRootResetToken += 1 }
        selectedTab = tab
    }

    func openChat(conversationID: UUID, contextTitle: String? = nil) {
        chatConversationID = conversationID
        chatContextTitle = contextTitle
        selectedTab = 2
    }

    func closeMissingChat() {
        chatConversationID = nil
        chatContextTitle = nil
        selectedTab = 0
    }
}

private struct AIChatTabView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch

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
            } else if isLoading {
                ProgressView("会話を読み込んでいます…").tint(FateTheme.ink)
            } else if errorMessage != nil {
                FLErrorState(kind: errorKind) { Task { await openLatestConversation() } }
                    .padding(24)
            } else {
                ContentUnavailableView("鑑定結果がありません", systemImage: "doc.text.magnifyingglass",
                                       description: Text("「あなたについて」から最初の鑑定を作成してください。"))
            }
        }
        .background(FateTheme.canvas)
        .task(id: auth.session?.user.id) { await openLatestConversation() }
    }

    private func openLatestConversation() async {
        guard auth.session != nil, tabRouter.chatConversationID == nil else { return }
        isLoading = true; defer { isLoading = false }
        do {
            tabRouter.chatConversationID = try await APIClient.shared.readings(auth: auth).first?.id
        } catch { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
