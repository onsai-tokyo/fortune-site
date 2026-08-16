import SwiftUI
import StoreKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @State private var serverPremium = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        List {
            Section("継続鑑定") {
                if purchases.isPremium || serverPremium {
                    Label("継続鑑定をご利用中です", systemImage: "checkmark.seal.fill").foregroundStyle(FateTheme.gold)
                    Button("サブスクリプションを管理") {
                        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
                        Task { try? await AppStore.showManageSubscriptions(in: scene) }
                    }
                } else if let session = auth.session {
                    Text("保存した鑑定書をもとに、回数の制限なく質問できます。")
                    Button(purchases.product.map { "\($0.displayPrice)／月で始める" } ?? "料金を確認しています") {
                        Task { await purchases.purchase(userID: session.user.id, accessToken: session.accessToken) }
                    }.disabled(purchases.product == nil || purchases.isWorking)
                } else {
                    Button("ログインしてプランを確認") { AuthPresentation.shared.isPresented = true }
                }
                if let message = purchases.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
            }
            if let session = auth.session {
                Section("購入") { Button("購入を復元") { Task { await purchases.restore(accessToken: session.accessToken) } } }
            }
            Section("アカウント") {
                if let email = auth.session?.user.email { Text(email) }
                if auth.session != nil {
                    Button("ログアウト") { auth.signOut() }.foregroundStyle(FateTheme.ink)
                    Button("アカウントを削除") { showDeleteConfirmation = true }.foregroundStyle(FateTheme.destructive)
                }
                else { Button("ログイン・新規登録") { AuthPresentation.shared.isPresented = true } }
            }
            Section("サービスについて") {
                Link("利用規約", destination: AppConfig.apiBaseURL.appending(path: "/terms"))
                Link("プライバシーポリシー", destination: AppConfig.apiBaseURL.appending(path: "/privacy"))
                Link("特定商取引法に基づく表記", destination: AppConfig.apiBaseURL.appending(path: "/tokushohou"))
            }
        }.scrollContentBackground(.hidden).background(FateTheme.ivory).fateScreenTitle("設定")
            .confirmationDialog("アカウントを削除しますか", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
                Button("削除する", role: .destructive) { Task { _ = await auth.deleteAccount() } }
                Button("キャンセル", role: .cancel) {}
            } message: {
                Text("保存した鑑定書と質問の履歴がすべて削除されます。この操作は取り消せません。継続鑑定をご利用中の場合は、App Storeの設定から別途解約してください。")
            }
            .task {
                guard let token = auth.session?.accessToken else { return }
                serverPremium = (try? await APIClient.shared.status(token: token).premium) ?? false
            }
    }
}
