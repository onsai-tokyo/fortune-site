import SwiftUI

@main
struct FateLabApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var purchases = PurchaseManager()

    var body: some Scene {
        WindowGroup { appContent }
    }

    @ViewBuilder private var appContent: some View {
#if DEBUG
        if let screen = ScreenshotMode.current {
            ScreenshotGalleryView(screen: screen)
                .environment(\.locale, Locale(identifier: "ja_JP"))
                .tint(FateTheme.ink)
                .preferredColorScheme(.light)
        } else {
            mainApp
        }
#else
        mainApp
#endif
    }

    private var mainApp: some View {
        RootView()
            .environmentObject(auth)
            .environmentObject(purchases)
            .environment(\.locale, Locale(identifier: "ja_JP"))
            .tint(FateTheme.ink)
            .preferredColorScheme(.light)
            .onOpenURL { url in Task { await auth.handleAuthCallback(url) } }
            .onAppear {
                auth.onSessionCleared = { purchases.resetForAccountChange() }
            }
    }
}
