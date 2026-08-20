import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var authPresentation = AuthPresentation.shared
    @StateObject private var tabRouter = AppTabRouter()
    @AppStorage("fatelab.onboarding.completed") private var onboardingCompleted = false
    @State private var onboardingInput: BirthInput?
    @State private var shouldAutoGenerate = false

    var body: some View {
        Group {
            if AppConfig.requiresAuthentication && auth.session == nil {
                AuthView(allowsDismissal: false)
            } else if onboardingCompleted {
                mainTabs
            } else {
                OnboardingView { input in
                    onboardingInput = input
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
    }

    private var mainTabs: some View {
        TabView(selection: $tabRouter.selectedTab) {
            NavigationStack { HomeView(initialInput: onboardingInput, autoGenerate: shouldAutoGenerate) }
                .tabItem { Label("あなたについて", systemImage: "person.text.rectangle") }.tag(0)
            NavigationStack { PartnerProfilesView() }
                .tabItem { Label("あの人とについて", systemImage: "person.2") }.tag(1)
            NavigationStack { AIChatTabView() }
                .tabItem { Label("AIチャット", systemImage: "bubble.left.and.bubble.right") }.tag(2)
            NavigationStack { SettingsView() }
                .tabItem { Label("設定", systemImage: "gearshape") }.tag(3)
        }
        .background(FateTheme.ivory)
    }
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
                    if let title = tabRouter.chatContextTitle {
                        Text("「\(title)」について質問できます")
                            .font(.caption).foregroundStyle(FateTheme.gold).padding(.horizontal, 14).padding(.vertical, 8)
                            .frame(maxWidth: .infinity).background(FateTheme.paper)
                    }
                    ReadingChatView(conversationID: conversationID)
                }
            } else if auth.session == nil {
                ContentUnavailableView {
                    Label("AIチャット", systemImage: "bubble.left.and.bubble.right")
                } description: {
                    Text("ログインすると、鑑定結果について質問できます。")
                } actions: {
                    Button("ログインする") { AuthPresentation.shared.isPresented = true }.buttonStyle(GoldButtonStyle())
                }
            } else if isLoading {
                ProgressView("会話を読み込んでいます…").tint(FateTheme.gold)
            } else {
                ContentUnavailableView("鑑定結果がありません", systemImage: "doc.text.magnifyingglass",
                                       description: Text(errorMessage ?? "「あなたについて」から最初の鑑定を作成してください。"))
            }
        }
        .background(FateTheme.ivory)
        .task(id: auth.session?.user.id) { await openLatestConversation() }
    }

    private func openLatestConversation() async {
        guard auth.session != nil, tabRouter.chatConversationID == nil else { return }
        isLoading = true; defer { isLoading = false }
        do {
            tabRouter.chatConversationID = try await APIClient.shared.readings(auth: auth).first?.id
        } catch { errorMessage = error.localizedDescription }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
