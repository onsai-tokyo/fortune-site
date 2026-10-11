import SwiftUI
import StoreKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @Environment(\.scenePhase) private var scenePhase
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
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && auth.session != nil { Task { await purchases.sync(auth: auth) } }
        }
    }

    private var membershipCard: some View {
        SettingsGroup(title: "メンバーシップ") {
            if purchases.isPremium {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Image(systemName: "sparkle")
                            .font(.title3).foregroundStyle(FateTheme.muted)
                        Text(purchases.membershipTitle).font(.system(.title3, weight: .medium))
                        Spacer()
                        Text(purchases.cancellationNotice == nil ? "会員資格あり" : "解約済み")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(FateTheme.ink, in: Capsule())
                    }
                    if let renewal = purchases.renewalDisplay, !renewal.willAutoRenew {
                        Text(renewal.expiresAt, format: .dateTime.month().day().hour().minute())
                            .font(.subheadline).foregroundStyle(FateTheme.ink)
                        Text("までご利用いただけます。自動更新は停止しています。")
                            .font(.caption).foregroundStyle(FateTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    } else if let renewal = purchases.renewalDisplay {
                        Text("次回更新：" + renewal.expiresAt.formatted(.dateTime.month().day()))
                            .font(.caption).foregroundStyle(FateTheme.muted)
                    } else {
                        Text("会員資格は有効です。自動更新の状態はAppleの管理画面で確認できます。")
                            .font(.caption).foregroundStyle(FateTheme.muted)
                    }
                }
                .padding(24)
                .background {
                    FateArtwork(name: "QuietMountains").opacity(0.12).clipped()
                }
            }
            if !AppConfig.storeKitEnabled {
                Text(AppConfig.purchasesUnavailableMessage)
                    .font(.footnote).foregroundStyle(FateTheme.muted).padding(20)
            } else if purchases.isPremium {
                SettingsDivider()
                Button {
                    guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
                    Task {
                        do { try await AppStore.showManageSubscriptions(in: scene) }
                        catch { purchases.errorMessage = "管理画面を開けませんでした。時間をおいて再度お試しください。"; return }
                        await purchases.sync(auth: auth)
                    }
                } label: {
                    SettingsUtilityRow(title: "サブスクリプションを管理", symbol: "slider.horizontal.3")
                }.buttonStyle(.plain)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    if auth.session != nil {
                        if purchases.needsMembershipRestore {
                            Text("このFATE LABアカウントは未加入です。Apple側には有効な購入があります。購入時のFATE LABアカウントでログインするか、購入情報を確認してください。")
                                .font(.footnote).foregroundStyle(FateTheme.muted)
                        }
                        SettingsMembershipButton()
                    } else {
                        Button("ログインしてプランを確認") { AuthPresentation.shared.isPresented = true }
                            .buttonStyle(FLPrimaryButtonStyle())
                    }
                    if !purchases.needsMembershipRestore { StorePurchasePrice(product: purchases.product) }
                }.padding(20)
            }
            if auth.session != nil && AppConfig.storeKitEnabled && !purchases.needsMembershipRestore {
                SettingsDivider()
                Button { Task { await purchases.restore(auth: auth) } } label: {
                    SettingsUtilityRow(title: purchases.isRestoring ? "購入情報を確認中…" : "購入を復元",
                                       symbol: "arrow.clockwise", isLoading: purchases.isRestoring)
                }
                .buttonStyle(.plain)
                .disabled(purchases.isWorking)
                .accessibilityIdentifier("settings.purchase.restore")
            }
            if purchases.isRestoring {
                Text(purchases.membershipProgress ?? "購入情報を確認しています…")
                    .font(.caption).foregroundStyle(FateTheme.muted)
                    .padding(.horizontal, 20).padding(.bottom, 16)
                    .accessibilityIdentifier("settings.purchase.restore.progress")
            } else if let message = purchases.restoreMessage, purchases.errorMessage == nil {
                HStack(alignment: .top, spacing: 10) {
                    Text(message).font(.footnote).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button { purchases.dismissRestoreMessage() } label: {
                        Image(systemName: "xmark").font(.caption).frame(width: 44, height: 44)
                    }.buttonStyle(.plain).accessibilityLabel("復元結果を閉じる")
                }
                .foregroundStyle(FateTheme.muted)
                .padding(.leading, 16).padding(.vertical, 8)
                .background(FateTheme.canvas, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16).padding(.bottom, 16)
                .accessibilityIdentifier("settings.purchase.restore.result")
            }
            if let message = purchases.errorMessage {
                Text(message).font(.footnote).foregroundStyle(FateTheme.danger)
                    .fixedSize(horizontal: false, vertical: true).padding(20)
            }
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
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line, lineWidth: 0.5).allowsHitTesting(false))
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
            HStack { Text(title); Spacer(); Image(systemName: LegalDocument.matching(destination) == nil ? "arrow.up.right" : "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }
                .foregroundStyle(FateTheme.ink).padding(.horizontal, 18).padding(.vertical, 8).frame(minHeight: 58).contentShape(Rectangle())
        }.inAppLegalLinks()
    }
}

private struct SettingsDivider: View {
    var edgeInset: CGFloat = 16
    var body: some View { Rectangle().fill(FateTheme.line).frame(height: 0.5).padding(.leading, edgeInset) }
}

/// Own the presentation at the purchase entry point, independently of Settings'
/// deletion dialog and its asynchronous account/status updates.
struct SettingsMembershipButton: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @State private var showingMembership = false

    var body: some View {
        Button {
            showingMembership = true
        } label: {
            Text(purchases.membershipActionTitle)
                .frame(maxWidth: .infinity, minHeight: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(FLPrimaryButtonStyle())
        .accessibilityIdentifier("settings.membership.open")
        .sheet(isPresented: $showingMembership) {
            PaywallSheet(draftQuestion: "") {
                if purchases.isPremium { showingMembership = false }
            }
            .environmentObject(auth)
            .environmentObject(purchases)
        }
        .onChange(of: AccountScope(auth)) { _, _ in showingMembership = false }
    }
}

private struct SettingsUtilityRow: View {
    let title: String
    let symbol: String
    var isLoading = false
    var body: some View {
        HStack(spacing: 12) {
            if isLoading { ProgressView().tint(FateTheme.ink).frame(width: 22) }
            else { Image(systemName: symbol).font(.body).foregroundStyle(FateTheme.muted).frame(width: 22) }
            Text(title).font(.subheadline)
            Spacer(minLength: 8)
            if !isLoading { Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }
        }
        .foregroundStyle(FateTheme.ink)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .frame(minHeight: 56).contentShape(Rectangle())
    }
}
