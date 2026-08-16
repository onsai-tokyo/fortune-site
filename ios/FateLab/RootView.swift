import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var authPresentation = AuthPresentation.shared
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { HomeView() }
                .tabItem { Label("鑑定", systemImage: "doc.text.magnifyingglass") }.tag(0)
            NavigationStack { ReadingListView(onNewReading: { selectedTab = 0 }) }
                .tabItem { Label("鑑定履歴", systemImage: "books.vertical") }.tag(1)
            NavigationStack { ProfileView() }
                .tabItem { Label("あなたについて", systemImage: "person.text.rectangle") }.tag(2)
            NavigationStack { SettingsView() }
                .tabItem { Label("設定", systemImage: "gearshape") }.tag(3)
        }
        .background(FateTheme.ivory)
        .sheet(isPresented: Binding(get: { auth.session == nil && authPresentation.isPresented },
                                    set: { authPresentation.isPresented = $0 })) {
            AuthView()
        }
    }
}

@MainActor
final class AuthPresentation: ObservableObject {
    static let shared = AuthPresentation()
    @Published var isPresented = false
}
