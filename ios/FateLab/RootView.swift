import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var authPresentation = AuthPresentation.shared
    @StateObject private var tabRouter = AppTabRouter()
    @AppStorage("fatelab.onboarding.completed") private var onboardingCompleted = false
    @AppStorage("fatelab.profile.birthInput") private var storedBirthInput = ""
    @State private var onboardingInput: BirthInput?
    @State private var shouldAutoGenerate = false
    @State private var showingSplash = true

    var body: some View {
        Group {
            if showingSplash {
                SplashView()
            } else if AppConfig.requiresAuthentication && auth.session == nil {
                AuthView(allowsDismissal: false)
            } else if onboardingCompleted {
                mainTabs
            } else {
                OnboardingView { input in
                    onboardingInput = input
                    if let data = try? JSONEncoder().encode(input) { storedBirthInput = data.base64EncodedString() }
                    shouldAutoGenerate = true
                    onboardingCompleted = true
                    tabRouter.selectedTab = 0
                }
            }
        }
        .sheet(isPresented: Binding(get: { auth.session == nil && authPresentation.isPresented },
                                    set: { authPresentation.isPresented = $0 })) {
            AuthView()
        }
        .environmentObject(tabRouter)
        .task { try? await Task.sleep(for: .seconds(1)); withAnimation(.easeOut(duration: 0.22)) { showingSplash = false } }
    }

    private var mainTabs: some View {
        TabView(selection: $tabRouter.selectedTab) {
            NavigationStack { YourReadingRootView(initialInput: onboardingInput ?? savedBirthInput, autoGenerate: shouldAutoGenerate) }
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

    private var savedBirthInput: BirthInput? { guard let data = Data(base64Encoded: storedBirthInput) else { return nil }; return try? JSONDecoder().decode(BirthInput.self, from: data) }
}

private struct YourReadingRootView: View {
    @EnvironmentObject private var auth: AuthStore
    let initialInput: BirthInput?
    let autoGenerate: Bool
    @State private var showsInput: Bool

    init(initialInput: BirthInput?, autoGenerate: Bool) {
        self.initialInput = initialInput
        self.autoGenerate = autoGenerate
        _showsInput = State(initialValue: autoGenerate)
    }

    var body: some View {
        if auth.session != nil && !showsInput {
            ReadingListView { showsInput = true }
        } else {
            HomeView(initialInput: initialInput, autoGenerate: autoGenerate)
        }
    }
}

private struct SplashView: View {
    var body: some View { VStack(spacing: 22) { FateMark(size: 88); Text("FATE LAB").font(.system(size: 15, weight: .medium)).tracking(5) }.frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas.ignoresSafeArea()) }
}

@MainActor
final class AppTabRouter: ObservableObject {
    @Published var selectedTab = 0
    @Published var chatConversationID: UUID?
    @Published var chatContextTitle: String?

    func openChat(conversationID: UUID, contextTitle: String? = nil) {
        chatConversationID = conversationID
        chatContextTitle = contextTitle
        selectedTab = 2
    }
}

private struct AIChatTabView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    @State private var isLoading = false
    @State private var errorMessage: String?

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
            } else {
                ContentUnavailableView("鑑定結果がありません", systemImage: "doc.text.magnifyingglass",
                                       description: Text(errorMessage ?? "「あなたについて」から最初の鑑定を作成してください。"))
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
        } catch { errorMessage = userFacingMessage(error) }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
