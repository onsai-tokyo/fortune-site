import SwiftUI
import StoreKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @State private var showDeleteConfirmation = false
    @State private var showMembershipSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                FateEditorialHero(eyebrow: "YOUR SPACE", title: "あなたの設定", subtitle: "プロフィールと、大切な言葉の記録を。")
                SettingsGroup(title: "あなたのデータ") {
                    NavigationLink { ProfileView() } label: { SettingsNavigationRow(title: "プロフィール") }
                    TimelineConsentWithdrawalView()
                }

                membershipCard

                SettingsGroup(title: "アカウント") {
                    if let email = auth.session?.user.email {
                        SettingsValueRow(title: "メールアドレス", value: email)
                        SettingsDivider()
                    }
                    if auth.session != nil {
                        SettingsActionRow(title: "ログアウト") { auth.signOut() }
                            .disabled(auth.isDeletingAccount)
                        SettingsDivider()
                        SettingsActionRow(title: "アカウントを削除", color: FateTheme.danger) {
                            auth.errorMessage = nil
                            showDeleteConfirmation = true
                        }.disabled(auth.isWorking)
                        if auth.isDeletingAccount {
                            HStack(spacing: 10) {
                                ProgressView().tint(FateTheme.ink)
                                Text("アカウントを削除しています…")
                            }.font(.footnote).padding(16)
                                .accessibilityIdentifier("account.deletion.progress")
                        }
                        if let message = auth.errorMessage {
                            Text(message).font(.footnote).foregroundStyle(FateTheme.danger)
                                .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                                .accessibilityIdentifier("account.deletion.error")
                        }
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
        .background(FateTheme.canvas)
        .fateScreenTitle("設定")
        .confirmationDialog("アカウントを削除しますか", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("削除する", role: .destructive) { Task { _ = await auth.deleteAccount() } }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("保存した鑑定書と質問の履歴がすべて削除されます。この操作は取り消せません。継続鑑定をご利用中の場合は、App Storeの設定から別途解約してください。")
        }
        .sheet(isPresented: $showMembershipSheet) {
            PaywallSheet(draftQuestion: "") {
                if purchases.isPremium { showMembershipSheet = false }
            }
        }
        .onChange(of: AccountScope(auth)) { _, _ in showMembershipSheet = false }
        .task { if auth.session != nil { await purchases.sync(auth: auth) } }
    }

    private var membershipCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("メンバーシップ")
                .font(.system(.caption, weight: .medium)).foregroundStyle(FateTheme.muted)
            VStack(alignment: .leading, spacing: 14) {
                if purchases.isPremium { MembershipActiveBanner() }
                if !AppConfig.storeKitEnabled {
                    Text(AppConfig.purchasesUnavailableMessage)
                        .font(.system(.footnote)).foregroundStyle(FateTheme.muted)
                } else if purchases.accessState == .premium {
                    Button("サブスクリプションを管理") {
                        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
                        Task { try? await AppStore.showManageSubscriptions(in: scene) }
                    }
                } else if auth.session != nil {
                    if purchases.needsMembershipRestore {
                        Text("Appleの購入履歴を、このアカウントに復元できます。")
                            .font(.footnote).foregroundStyle(FateTheme.muted)
                    }
                    Button(purchases.membershipActionTitle) {
                        showMembershipSheet = true
                    }.buttonStyle(FLPrimaryButtonStyle())
                } else {
                    Button("ログインしてプランを確認") { AuthPresentation.shared.isPresented = true }.buttonStyle(FLPrimaryButtonStyle())
                }
                MembershipDetailsView()
                    .padding(.top, 8)
                if let message = purchases.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
                if !purchases.isPremium && !purchases.needsMembershipRestore {
                    StorePurchasePrice(product: purchases.product)
                }
                if auth.session != nil && AppConfig.storeKitEnabled && !purchases.needsMembershipRestore {
                    SettingsDivider(edgeInset: 0)
                    Button("購入を復元") { Task { await purchases.restore(auth: auth) } }
                        .frame(minHeight: 56).foregroundStyle(FateTheme.ink)
                }
            }
            .padding(22)
            .background(FateTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line, lineWidth: 0.5))
        }
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(.caption, weight: .medium)).foregroundStyle(FateTheme.muted)
            VStack(spacing: 0) { content }
                .background(FateTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line, lineWidth: 0.5))
        }
    }
}

private struct SettingsNavigationRow: View {
    let title: String
    var body: some View {
        HStack(spacing: 14) { Image(systemName: "person.crop.circle").font(.title3).foregroundStyle(FateTheme.muted); Text(title); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }
            .foregroundStyle(FateTheme.ink).padding(.horizontal, 18).padding(.vertical, 8).frame(minHeight: 58).contentShape(Rectangle())
    }
}

private struct SettingsValueRow: View {
    let title: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(FateTheme.muted)
            Text(value).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity, minHeight: 56, alignment: .leading).padding(.horizontal, 16)
    }
}

private struct SettingsActionRow: View {
    let title: String
    var color: Color = FateTheme.ink
    let action: () -> Void
    var body: some View {
        Button(title, action: action).foregroundStyle(color)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading).padding(.horizontal, 16).contentShape(Rectangle())
    }
}

private struct SettingsLinkRow: View {
    let title: String
    let destination: URL
    var body: some View {
        Link(destination: destination) {
            HStack { Text(title); Spacer(); Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(FateTheme.muted) }
                .foregroundStyle(FateTheme.ink).padding(.horizontal, 18).padding(.vertical, 8).frame(minHeight: 58).contentShape(Rectangle())
        }
    }
}

private struct SettingsDivider: View {
    var edgeInset: CGFloat = 16
    var body: some View { Rectangle().fill(FateTheme.line).frame(height: 0.5).padding(.leading, edgeInset) }
}
