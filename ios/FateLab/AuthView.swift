import SwiftUI
import AuthenticationServices

struct AuthView: View {
    var allowsDismissal = true
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var route: Route = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var cooldown = 0
    private enum Route { case landing, register, login, pending }

    var body: some View {
        NavigationStack {
            Group { switch route { case .landing: landing; case .register: emailForm(registering: true); case .login: emailForm(registering: false); case .pending: verificationPending } }
                .padding(.horizontal, 24).padding(.bottom, 24).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas)
                .toolbar { if allowsDismissal { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } } }
        }
    }

    private var landing: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(); FateMark(size: 84).frame(maxWidth: .infinity); Text("FATE LAB").font(.system(size: 13, weight: .medium)).tracking(4).frame(maxWidth: .infinity).padding(.top, 20)
            Spacer().frame(height: 48)
            Text("あなたの鑑定を、\n保存できるように。").font(.system(size: 30, weight: .bold)).lineSpacing(5)
            Text("ログインすると、鑑定結果と対話をいつでも引き継げます。").font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(5).padding(.top, 16)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).padding(.top, 12) }
            Spacer()
            Button("Googleで続ける") { Task { await auth.signInWithGoogle(); closeIfAuthenticated() } }.buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking)
            Button("メールアドレスで続ける") { route = .register }.buttonStyle(FLSecondaryButtonStyle()).padding(.top, 12)
            HStack(spacing: 4) { Text("すでにアカウントをお持ちですか？").foregroundStyle(FateTheme.muted); Button("ログイン") { route = .login }.fontWeight(.semibold).foregroundStyle(FateTheme.ink) }.font(.system(size: 14)).frame(maxWidth: .infinity).padding(.top, 22)
            SignInWithAppleButton(.continue) { auth.prepareAppleSignIn($0) } onCompletion: { result in Task { await auth.completeAppleSignIn(result); closeIfAuthenticated() } }.signInWithAppleButtonStyle(.whiteOutline).frame(height: 44).padding(.top, 16)
        }
    }

    private func emailForm(registering: Bool) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack { Button { route = .landing; auth.errorMessage = nil } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("前へ戻る"); Spacer() }
            Spacer().frame(height: 24)
            Text(registering ? "メールで続ける" : "ログイン").font(.system(size: 30, weight: .bold))
            Text(registering ? "確認メールを受け取れるアドレスを入力してください。" : "登録したメールアドレスとパスワードを入力してください。").foregroundStyle(FateTheme.muted)
            VStack(spacing: 12) {
                TextField("メールアドレス", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress).padding(16).overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
                SecureField("パスワード（8文字以上）", text: $password).padding(16).overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
            }
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            if let message = auth.noticeMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.muted) }
            Spacer()
            Button(registering ? "登録する" : "ログイン") { Task { if registering { await auth.signUp(email: email, password: password); if auth.errorMessage == nil { route = .pending } } else { await auth.signIn(email: email, password: password); closeIfAuthenticated() } } }.buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking || email.isEmpty || password.count < 8)
            FLTextLink(title: registering ? "ログインへ" : "新規登録へ") { route = registering ? .login : .register; auth.errorMessage = nil }.frame(maxWidth: .infinity)
        }
    }

    private var verificationPending: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer(); FateMark(size: 64)
            Text("確認メールを送りました。").font(.system(size: 30, weight: .bold))
            Text("メール内のリンクを開いて登録を完了してください。届かない場合は迷惑メールフォルダも確認してください。").foregroundStyle(FateTheme.muted).lineSpacing(5)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            Spacer()
            Button(cooldown > 0 ? "再送まで \(cooldown)秒" : "確認メールを再送する") { Task { await auth.resendConfirmation(email: email); if auth.errorMessage == nil { cooldown = 60 } } }.buttonStyle(FLSecondaryButtonStyle()).disabled(cooldown > 0 || auth.isWorking)
            FLTextLink(title: "ログインへ戻る") { route = .login }.frame(maxWidth: .infinity)
        }.task(id: cooldown) { guard cooldown > 0 else { return }; try? await Task.sleep(for: .seconds(1)); cooldown -= 1 }
    }

    private func closeIfAuthenticated() { if auth.session != nil { dismiss() } }
}
