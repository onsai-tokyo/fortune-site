import SwiftUI
import StoreKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @State private var showDeleteConfirmation = false

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
        .task { if auth.session != nil { await purchases.sync(auth: auth) } }
    }

    private func membershipStat(_ value: String, detail: String) -> some View {
        VStack(spacing: 7) { Text(value).font(.system(.title3, design: .default, weight: .medium)); Text(detail).font(.caption).foregroundStyle(FateTheme.muted) }.frame(maxWidth: .infinity)
    }
    private var membershipCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("メンバーシップ")
                .font(.system(.caption, weight: .medium)).foregroundStyle(FateTheme.muted)
            VStack(alignment: .leading, spacing: 14) {
                Text("FATE LAB 継続鑑定").font(.system(.title3, weight: .semibold))
                if purchases.isPremium { MembershipActiveBanner() }
                HStack(spacing: 0) {
                    membershipStat("毎月3通", detail: "相談の鑑定書")
                    Rectangle().fill(FateTheme.line).frame(width: 0.5, height: 36)
                    membershipStat("10人まで", detail: "相手の登録")
                }.padding(.vertical, 10)
                DisclosureGroup("プランの内容を確認") { MembershipDetailsView().padding(.top, 14) }
                    .font(.subheadline).tint(FateTheme.ink)
                if !AppConfig.storeKitEnabled {
                    Text(AppConfig.purchasesUnavailableMessage)
                        .font(.system(.footnote)).foregroundStyle(FateTheme.muted)
                } else if auth.session != nil && purchases.accessState == .unknown {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            if purchases.isSyncing {
                                ProgressView().tint(FateTheme.ink)
                                Text("購入状況を確認しています").foregroundStyle(FateTheme.muted)
                            } else {
                                Text("購入状況を確認できていません").foregroundStyle(FateTheme.muted)
                            }
                        }
                        Button("もう一度確認する") { Task { await purchases.sync(auth: auth) } }
                            .frame(minHeight: 44)
                            .disabled(purchases.isSyncing)
                    }.frame(minHeight: 56)
                } else if purchases.accessState == .premium {
                    Button("サブスクリプションを管理") {
                        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
                        Task { try? await AppStore.showManageSubscriptions(in: scene) }
                    }
                } else if purchases.accessState == .standard, let session = auth.session {
                    Text("保存した鑑定書をもとに、気になることをさらに相談できます。")
                        .font(.system(.footnote)).foregroundStyle(FateTheme.muted).lineSpacing(4)
                    Button(purchases.product.map { "\($0.displayPrice)／月で始める" } ?? "料金を確認しています") {
                        Task { await purchases.purchase(userID: session.user.id, auth: auth) }
                    }.buttonStyle(FLPrimaryButtonStyle()).disabled(purchases.product == nil || purchases.isWorking || purchases.isSyncing)
                } else {
                    Button("ログインしてプランを確認") { AuthPresentation.shared.isPresented = true }.buttonStyle(FLPrimaryButtonStyle())
                }
                if let message = purchases.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
                if auth.session != nil && AppConfig.storeKitEnabled {
                    SettingsDivider(edgeInset: 0)
                    Button("購入を復元") { Task { await purchases.restore(auth: auth) } }
                        .frame(minHeight: 56).foregroundStyle(FateTheme.ink)
                }
            }
            .padding(18)
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
        VStack(alignment: .leading, spacing: 8) {
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
