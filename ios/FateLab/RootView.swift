import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var authPresentation = AuthPresentation.shared
    @State private var selectedTab = 0
    @AppStorage("fatelab.onboarding.completed") private var onboardingCompleted = false
    @State private var onboardingInput: BirthInput?
    @State private var shouldAutoGenerate = false

    var body: some View {
        Group {
            if onboardingCompleted {
                mainTabs
            } else {
                OnboardingView { input in
                    onboardingInput = input
                    shouldAutoGenerate = true
                    onboardingCompleted = true
                    selectedTab = 0
                }
            }
        }
        .sheet(isPresented: Binding(get: { auth.session == nil && authPresentation.isPresented },
                                    set: { authPresentation.isPresented = $0 })) {
            AuthView()
        }
    }

    private var mainTabs: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { HomeView(initialInput: onboardingInput, autoGenerate: shouldAutoGenerate) }
                .tabItem { Label("鑑定", systemImage: "doc.text.magnifyingglass") }.tag(0)
            NavigationStack { ReadingListView(onNewReading: { selectedTab = 0 }) }
                .tabItem { Label("鑑定履歴", systemImage: "books.vertical") }.tag(1)
            NavigationStack { ProfileView() }
                .tabItem { Label("あなたについて", systemImage: "person.text.rectangle") }.tag(2)
            NavigationStack { SettingsView() }
                .tabItem { Label("設定", systemImage: "gearshape") }.tag(3)
        }
        .background(FateTheme.ivory)
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
