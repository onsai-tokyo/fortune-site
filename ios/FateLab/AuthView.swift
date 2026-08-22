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
    private enum Route { case landing, registrationMethods, registerEmail, loginEmail, pending }

    var body: some View {
        NavigationStack {
            Group {
                switch route {
                case .landing: loginLanding
                case .registrationMethods: registrationMethods
                case .registerEmail: emailForm(registering: true)
                case .loginEmail: emailForm(registering: false)
                case .pending: verificationPending
                }
            }
                .padding(.horizontal, 24).padding(.bottom, 24).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas)
                .toolbar { if allowsDismissal { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } } }
        }
    }

    private var loginLanding: some View {
        VStack(alignment: .center, spacing: 0) {
            Spacer(); FateMark(size: 84).frame(maxWidth: .infinity); Text("FATE LAB").font(.system(size: 13, weight: .medium)).tracking(4).frame(maxWidth: .infinity).padding(.top, 20)
            Spacer().frame(height: 48)
            Text("ログインして、\n鑑定を続きから。").font(.system(size: 30, weight: .bold)).lineSpacing(5).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            Text("ログインすると、鑑定結果と対話をいつでも引き継げます。").font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(5).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 16)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).multilineTextAlignment(.center).padding(.top, 12) }
            Spacer()
            Button("メールアドレスでログイン") { move(to: .loginEmail) }
                .buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking)
            socialDivider
            VStack(spacing: 12) {
                Button { Task { await auth.signInWithGoogle(); closeIfAuthenticated() } } label: {
                    googleButtonLabel("Googleでログイン")
                }
                    .buttonStyle(FLSecondaryButtonStyle()).disabled(auth.isWorking)
                SignInWithAppleButton(.signIn) { auth.prepareAppleSignIn($0) } onCompletion: { result in
                    Task { await auth.completeAppleSignIn(result); closeIfAuthenticated() }
                }
                .signInWithAppleButtonStyle(.whiteOutline).frame(maxWidth: .infinity).frame(height: 56)
            }
            HStack(spacing: 4) {
                Text("アカウントをお持ちでない方").foregroundStyle(FateTheme.muted)
                Button("新規登録はこちら") { move(to: .registrationMethods) }.fontWeight(.semibold).foregroundStyle(FateTheme.ink)
            }
            .font(.system(size: 14)).frame(maxWidth: .infinity).padding(.top, 22)
        }
    }

    private var registrationMethods: some View {
        VStack(alignment: .center, spacing: 20) {
            Spacer()
            Text("新規登録").font(.system(size: 30, weight: .bold)).frame(maxWidth: .infinity)
            Text("登録方法を選択してください。").foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).multilineTextAlignment(.center) }
            Spacer()
            Button("メールアドレスで登録") { move(to: .registerEmail) }
                .buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking)
            socialDivider
            VStack(spacing: 12) {
                Button { Task { await auth.signInWithGoogle(); closeIfAuthenticated() } } label: {
                    googleButtonLabel("Googleで登録")
                }
                    .buttonStyle(FLSecondaryButtonStyle()).disabled(auth.isWorking)
                SignInWithAppleButton(.signUp) { auth.prepareAppleSignIn($0) } onCompletion: { result in
                    Task { await auth.completeAppleSignIn(result); closeIfAuthenticated() }
                }
                .signInWithAppleButtonStyle(.whiteOutline).frame(maxWidth: .infinity).frame(height: 56)
            }
            FLTextLink(title: "ログインへ戻る") { move(to: .landing) }.frame(maxWidth: .infinity)
        }
        .overlay(alignment: .topLeading) { backButton(to: .landing) }
    }

    private func emailForm(registering: Bool) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            backButton(to: registering ? .registrationMethods : .landing)
            Spacer().frame(height: 24)
            Text(registering ? "メールで続ける" : "ログイン").font(.system(size: 30, weight: .bold))
            Text(registering ? "確認メールを受け取れるアドレスを入力してください。" : "登録したメールアドレスとパスワードを入力してください。").foregroundStyle(FateTheme.muted)
            VStack(spacing: 12) {
                TextField("メールアドレス", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress).padding(16).overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
                SecureField("パスワード（8文字以上）", text: $password).padding(16).overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.line))
            }
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            if let message = auth.noticeMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.muted) }
            if !registering {
                Text("パスワード未設定の場合はGoogleまたはAppleでログインしてください。")
                    .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4)
            }
            Spacer()
            Button(registering ? "登録する" : "ログイン") { Task { if registering { await auth.signUp(email: email, password: password); if auth.session != nil { closeIfAuthenticated() } else { auth.errorMessage = nil; route = .pending } } else { await auth.signIn(email: email, password: password); closeIfAuthenticated() } } }.buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking || email.isEmpty || password.count < 8)
            FLTextLink(title: registering ? "ログインへ" : "新規登録へ") { move(to: registering ? .landing : .registrationMethods) }.frame(maxWidth: .infinity)
        }
    }

    private var verificationPending: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer(); FateMark(size: 64)
            Text("メールをご確認ください。").font(.system(size: 30, weight: .bold))
            Text("登録可能な場合は確認メールが届きます。メール内のリンクを開いて登録を完了してください。届かない場合は迷惑メールフォルダも確認してください。").foregroundStyle(FateTheme.muted).lineSpacing(5)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            Spacer()
            Button(cooldown > 0 ? "再送まで \(cooldown)秒" : "確認メールを再送する") { Task { await auth.resendConfirmation(email: email); if auth.errorMessage == nil { cooldown = 60 } } }.buttonStyle(FLSecondaryButtonStyle()).disabled(cooldown > 0 || auth.isWorking)
            FLTextLink(title: "ログインへ戻る") { move(to: .landing) }.frame(maxWidth: .infinity)
        }.task(id: cooldown) { guard cooldown > 0 else { return }; try? await Task.sleep(for: .seconds(1)); cooldown -= 1 }
    }

    private func backButton(to destination: Route) -> some View {
        HStack {
            Button { move(to: destination) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                .accessibilityLabel("前へ戻る")
            Spacer()
        }
    }

    private var socialDivider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(FateTheme.line).frame(height: 0.5)
            Text("または").font(.caption).foregroundStyle(FateTheme.muted)
            Rectangle().fill(FateTheme.line).frame(height: 0.5)
        }.padding(.vertical, 14)
    }

    private func googleButtonLabel(_ title: String) -> some View {
        HStack(spacing: 12) {
            Image("GoogleLogo").resizable().aspectRatio(contentMode: .fit).frame(width: 18, height: 18)
            Text(title)
        }
        .frame(maxWidth: .infinity)
    }

    private func move(to destination: Route) {
        auth.errorMessage = nil
        auth.noticeMessage = nil
        route = destination
    }

    private func closeIfAuthenticated() { if auth.session != nil { dismiss() } }
}
