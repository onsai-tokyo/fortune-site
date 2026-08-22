import SwiftUI
import StoreKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @State private var serverPremium = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                SettingsGroup(title: "あなたのデータ") {
                    NavigationLink { ProfileView() } label: { SettingsNavigationRow(title: "プロフィール") }
                }

                SettingsGroup(title: "鑑定と対話") {
                    NavigationLink { ReadingListView() } label: { SettingsNavigationRow(title: "鑑定履歴") }
                    SettingsDivider()
                    NavigationLink { ProfileView() } label: { SettingsNavigationRow(title: "会話からわかったこと") }
                }

                membershipCard

                SettingsGroup(title: "アカウント") {
                    if let email = auth.session?.user.email {
                        SettingsValueRow(title: "メールアドレス", value: email)
                        SettingsDivider()
                    }
                    if auth.session != nil {
                        SettingsActionRow(title: "ログアウト") { auth.signOut() }
                        SettingsDivider()
                        SettingsActionRow(title: "アカウントを削除", color: FateTheme.danger) { showDeleteConfirmation = true }
                    } else {
                        SettingsActionRow(title: "ログイン・新規登録") { AuthPresentation.shared.isPresented = true }
                    }
                    SettingsDivider()
                    SettingsLinkRow(title: "利用規約", destination: AppConfig.websiteBaseURL.appending(path: "/terms"))
                    SettingsDivider()
                    SettingsLinkRow(title: "プライバシーポリシー", destination: AppConfig.websiteBaseURL.appending(path: "/privacy"))
                    SettingsDivider()
                    SettingsLinkRow(title: "特定商取引法に基づく表記", destination: AppConfig.websiteBaseURL.appending(path: "/tokushohou"))
                }
            }
            .padding(.horizontal, FateSpacing.screenH)
            .padding(.top, 18)
            .padding(.bottom, 48)
        }
        .font(FateType.body)
        .tint(FateTheme.ink)
        .background(FateTheme.surface)
        .fateScreenTitle("設定")
        .confirmationDialog("アカウントを削除しますか", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("削除する", role: .destructive) { Task { _ = await auth.deleteAccount() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("保存した鑑定書と質問の履歴がすべて削除されます。この操作は取り消せません。継続鑑定をご利用中の場合は、App Storeの設定から別途解約してください。")
        }
        .task {
            guard auth.session != nil else { return }
            serverPremium = (try? await APIClient.shared.status(auth: auth).premium) ?? false
        }
    }

    private var membershipCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("メンバーシップ")
                .font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            VStack(alignment: .leading, spacing: 14) {
                Text("FATE LAB 継続鑑定").font(.system(size: 19, weight: .semibold))
                if purchases.isPremium || serverPremium {
                    Label("継続鑑定をご利用中です", systemImage: "checkmark.seal.fill").foregroundStyle(FateTheme.ink)
                    Button("サブスクリプションを管理") {
                        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
                        Task { try? await AppStore.showManageSubscriptions(in: scene) }
                    }
                } else if let session = auth.session {
                    Text("保存した鑑定書をもとに、回数の制限なく質問できます。")
                        .font(.system(size: 14)).foregroundStyle(FateTheme.muted).lineSpacing(4)
                    Button(purchases.product.map { "\($0.displayPrice)／月で始める" } ?? "料金を確認しています") {
                        Task { await purchases.purchase(userID: session.user.id, auth: auth) }
                    }.buttonStyle(FLPrimaryButtonStyle()).disabled(purchases.product == nil || purchases.isWorking)
                } else {
                    Button("ログインしてプランを確認") { AuthPresentation.shared.isPresented = true }.buttonStyle(FLPrimaryButtonStyle())
                }
                if let message = purchases.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
                if auth.session != nil {
                    SettingsDivider(edgeInset: 0)
                    Button("購入を復元") { Task { await purchases.restore(auth: auth) } }
                        .frame(minHeight: 48).foregroundStyle(FateTheme.ink)
                }
            }
            .padding(18)
            .background(FateTheme.canvas)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line, lineWidth: 0.5))
        }
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            VStack(spacing: 0) { content }
                .background(FateTheme.canvas)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line, lineWidth: 0.5))
        }
    }
}

private struct SettingsNavigationRow: View {
    let title: String
    var body: some View {
        HStack { Text(title); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }
            .foregroundStyle(FateTheme.ink).padding(.horizontal, 16).frame(minHeight: 48).contentShape(Rectangle())
    }
}

private struct SettingsValueRow: View {
    let title: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(FateTheme.muted)
            Text(value).lineLimit(1).minimumScaleFactor(0.8)
        }.frame(maxWidth: .infinity, minHeight: 48, alignment: .leading).padding(.horizontal, 16)
    }
}

private struct SettingsActionRow: View {
    let title: String
    var color: Color = FateTheme.ink
    let action: () -> Void
    var body: some View {
        Button(title, action: action).foregroundStyle(color)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading).padding(.horizontal, 16).contentShape(Rectangle())
    }
}

private struct SettingsLinkRow: View {
    let title: String
    let destination: URL
    var body: some View {
        Link(destination: destination) {
            HStack { Text(title); Spacer(); Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(FateTheme.muted) }
                .foregroundStyle(FateTheme.ink).padding(.horizontal, 16).frame(minHeight: 48).contentShape(Rectangle())
        }
    }
}

private struct SettingsDivider: View {
    var edgeInset: CGFloat = 16
    var body: some View { Rectangle().fill(FateTheme.line).frame(height: 0.5).padding(.leading, edgeInset) }
}
