import SwiftUI
import AuthenticationServices

struct AuthView: View {
    var allowsDismissal = true
    var showsWelcome = false
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var route: Route = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var cooldown = 0
    @State private var welcomeDismissed = false
    private enum Route { case landing, registrationMethods, registerEmail, loginEmail, pending }

    var body: some View {
        Group {
        if showsWelcome && !welcomeDismissed {
            // Presentation only. Both entries lead to the existing login screen;
            // no session, account, onboarding draft or auth route is changed here.
            WelcomeView { welcomeDismissed = true }
        } else {
            authenticationContent
                .onAppear { welcomeDismissed = true }
        }
        }
    }

    private var authenticationContent: some View {
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
                .padding(.horizontal, 24).padding(.bottom, 24).frame(maxWidth: .infinity, maxHeight: .infinity)
                .background {
                    FateTheme.canvas.ignoresSafeArea()
                    if route == .landing {
                        VStack { Spacer(); FateArtwork(name: "QuietMountains").frame(height: 240)
                                .mask(LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .top, endPoint: .bottom))
                        }.ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
                    }
                }
                .toolbar {
                    if let destination = backDestination {
                        ToolbarItem(placement: .topBarLeading) { backButton(to: destination) }
                    }
                    if allowsDismissal {
                        ToolbarItem(placement: .topBarTrailing) { Button("閉じる") { dismiss() } }
                    }
                }
        }
    }

    private var loginLanding: some View {
        GeometryReader { geometry in
        ScrollView {
        VStack(alignment: .center, spacing: 0) {
            Spacer(minLength: 24); FateMark(size: 60).padding(26).background(FateTheme.cream.opacity(0.55), in: Circle()).frame(maxWidth: .infinity); Text("FATE LAB").font(.system(size: 12, weight: .medium)).tracking(5).frame(maxWidth: .infinity).padding(.top, 22)
            Spacer().frame(height: 32)
            Text("ログインして、\n鑑定を続きから。").font(.system(.title2, weight: .medium)).lineSpacing(7).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            Text("ログインすると、鑑定結果と対話をいつでも引き継げます。").font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 14)
            if let message = auth.noticeMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).padding(.top, 12) }
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).multilineTextAlignment(.center).padding(.top, 12) }
            Spacer(minLength: 32)
            Button("メールアドレスでログイン") { move(to: .loginEmail) }
                .buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking)
            if auth.isWorking { ProgressView("ログインを確認しています…").font(.footnote).padding(.top, 12) }
            socialDivider
            VStack(spacing: 10) {
                Button { Task { await auth.signInWithGoogle(); closeIfAuthenticated() } } label: {
                    googleButtonLabel("Googleでログイン")
                }
                    .buttonStyle(SocialSignInButtonStyle()).disabled(auth.isWorking)
                SignInWithAppleButton(.signIn) { auth.prepareAppleSignIn($0) } onCompletion: { result in
                    Task { await auth.completeAppleSignIn(result); closeIfAuthenticated() }
                }
                .signInWithAppleButtonStyle(.white).frame(maxWidth: .infinity).frame(height: 44)
                .frame(height: 52).background(FateTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: FLRadius.button)).disabled(auth.isWorking)
            }
            VStack(spacing: 2) {
                Text("アカウントをお持ちでない方").foregroundStyle(FateTheme.muted)
                Button("新規登録はこちら") { move(to: .registrationMethods) }.fontWeight(.semibold).foregroundStyle(FateTheme.ink).frame(minHeight: 44)
            }
            .font(.footnote).frame(maxWidth: .infinity).padding(.top, 26)
            Spacer(minLength: 16)
        }
        .frame(minHeight: geometry.size.height)
        }
        .scrollIndicators(.hidden)
        }
    }

    private var registrationMethods: some View {
        GeometryReader { geometry in
        ScrollView { VStack(alignment: .center, spacing: 20) {
            Spacer()
            Text("新規登録").font(.system(.title2, weight: .medium)).frame(maxWidth: .infinity)
            Text("登録方法を選択してください。").foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).multilineTextAlignment(.center) }
            Spacer()
            Button("メールアドレスで登録") { move(to: .registerEmail) }
                .buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking)
            if auth.isWorking { ProgressView("ログインを確認しています…").font(.footnote).padding(.top, 12) }
            socialDivider
            VStack(spacing: 10) {
                Button { Task { await auth.signInWithGoogle(); closeIfAuthenticated() } } label: {
                    googleButtonLabel("Googleで登録")
                }
                    .buttonStyle(SocialSignInButtonStyle()).disabled(auth.isWorking)
                SignInWithAppleButton(.signUp) { auth.prepareAppleSignIn($0) } onCompletion: { result in
                    Task { await auth.completeAppleSignIn(result); closeIfAuthenticated() }
                }
                .signInWithAppleButtonStyle(.white).frame(maxWidth: .infinity).frame(height: 44)
                .frame(height: 52).background(FateTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: FLRadius.button)).disabled(auth.isWorking)
            }
            FLTextLink(title: "ログインへ戻る") { move(to: .landing) }.frame(maxWidth: .infinity)
        }.frame(minHeight: geometry.size.height) }.scrollIndicators(.hidden)
        }
    }

    private func emailForm(registering: Bool) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(registering ? "メールで続ける" : "ログイン").font(.system(.title2, weight: .medium))
                    Text(registering ? "確認メールを受け取れるアドレスを入力してください。" : "登録したメールアドレスとパスワードを入力してください。")
                        .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
                    VStack(spacing: 12) {
                        TextField("メールアドレス", text: $email, prompt: Text("メールアドレス").foregroundStyle(FateTheme.muted)).font(FateType.body).textInputAutocapitalization(.never).keyboardType(.emailAddress).textContentType(.emailAddress).autocorrectionDisabled().fateInput()
                        SecureField("パスワード（8文字以上）", text: $password, prompt: Text("パスワード（8文字以上）").foregroundStyle(FateTheme.muted)).font(FateType.body).textContentType(registering ? .newPassword : .password).fateInput()
                    }
                    if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger).fixedSize(horizontal: false, vertical: true) }
                    if let message = auth.noticeMessage { Text(message).font(.footnote).font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
                    if !registering {
                        Text("パスワード未設定の場合はGoogleまたはAppleでログインしてください。")
                            .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    }
                }.padding(.top, 24).frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            Button(registering ? "登録する" : "ログイン") { Task { if registering { await auth.signUp(email: email, password: password); if auth.session != nil { closeIfAuthenticated() } else if auth.errorMessage == nil && auth.noticeMessage != nil { route = .pending } } else { await auth.signIn(email: email, password: password); closeIfAuthenticated() } } }.buttonStyle(FLPrimaryButtonStyle()).disabled(auth.isWorking || email.isEmpty || password.count < 8)
            FLTextLink(title: registering ? "ログインへ" : "新規登録へ") { move(to: registering ? .landing : .registrationMethods) }.frame(maxWidth: .infinity)
        }
    }

    private var verificationPending: some View {
        GeometryReader { geometry in
        ScrollView { VStack(alignment: .leading, spacing: 20) {
            Spacer(); FateMark(size: 64)
            Text("メールをご確認ください。").font(.system(.title2, weight: .medium))
            Text("新規登録の場合は確認メールが届きます。メール内のリンクを開いて登録を完了してください。届かない場合は、入力したアドレスと迷惑メールフォルダを確認してください。")
                .foregroundStyle(FateTheme.muted).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
            Text("すでに登録済みの方は確認メールを待たず、以前と同じ方法（Google・Apple・メール）でログインしてください。")
                .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
            if let message = auth.errorMessage { Text(message).font(.footnote).foregroundStyle(FateTheme.danger) }
            Spacer()
            Button(cooldown > 0 ? "再送まで \(cooldown)秒" : "確認メールを再送する") { Task { await auth.resendConfirmation(email: email); if auth.errorMessage == nil { cooldown = 60 } } }.buttonStyle(FLSecondaryButtonStyle()).disabled(cooldown > 0 || auth.isWorking)
            FLTextLink(title: "メールアドレスを修正する") { move(to: .registerEmail) }.frame(maxWidth: .infinity)
            FLTextLink(title: "ログインへ戻る") { move(to: .landing) }.frame(maxWidth: .infinity)
        }.frame(minHeight: geometry.size.height) }.scrollIndicators(.hidden)
        }.task(id: cooldown) { guard cooldown > 0 else { return }; try? await Task.sleep(for: .seconds(1)); cooldown -= 1 }
    }

    private func backButton(to destination: Route) -> some View {
        Button { move(to: destination) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
            .accessibilityLabel("前へ戻る")
    }

    private var backDestination: Route? {
        switch route {
        case .registrationMethods, .loginEmail: .landing
        case .registerEmail: .registrationMethods
        case .landing, .pending: nil
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
            Text(title).font(FateType.button)
        }
        .frame(maxWidth: .infinity)
    }

    private func move(to destination: Route) {
        auth.errorMessage = nil
        auth.noticeMessage = nil
        route = destination
    }

    private func closeIfAuthenticated() { if auth.session != nil && auth.state == .authenticated { dismiss() } }
}

/// A visual introduction; continuing always uses the existing authentication UI.
struct WelcomeView: View {
    let onContinue: () -> Void

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 24)
                    FateMark(size: 72, color: FateTheme.cream)
                        .accessibilityHidden(true)
                    Text("FATE LAB")
                        .font(.system(size: 12, weight: .medium)).tracking(5)
                        .padding(.top, 24)
                    Text("知ることで、\n人生は、やさしく動き出す。")
                        .font(.system(.title3, weight: .regular)).lineSpacing(15)
                        .multilineTextAlignment(.center).padding(.top, 38)
                    Text("Know yourself. Live freely.")
                        .font(.system(.caption, design: .default)).foregroundStyle(FateTheme.cream.opacity(0.85))
                        .padding(.top, 26)
                    Spacer(minLength: 24)
                    Button(action: onContinue) {
                        HStack(spacing: 14) { Text("はじめる"); Image(systemName: "arrow.right") }
                            .font(.system(.body, weight: .medium))
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .foregroundStyle(FateTheme.ink)
                            .background(FateTheme.cream, in: Capsule())
                    }.buttonStyle(.plain).accessibilityIdentifier("welcome.begin")
                    Button(action: onContinue) {
                        (Text("すでにアカウントをお持ちの方 ") + Text("ログイン").bold())
                            .font(.footnote).multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }.buttonStyle(.plain).accessibilityIdentifier("welcome.login")
                        .padding(.top, 8)
                }
                .padding(.horizontal, 28).padding(.top, 24).padding(.bottom, 16)
                .frame(minHeight: geometry.size.height)
            }.scrollIndicators(.hidden)
        }
        .foregroundStyle(FateTheme.cream)
        .background {
            FateArtwork(name: "WelcomeSky").ignoresSafeArea()
                .overlay(Color.black.opacity(0.12).ignoresSafeArea())
                .allowsHitTesting(false).accessibilityHidden(true)
        }
        .preferredColorScheme(.dark)
    }
}

private struct SocialSignInButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 16).padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(FateTheme.ink)
            .background(FateTheme.card, in: RoundedRectangle(cornerRadius: FLRadius.button))
            .overlay(RoundedRectangle(cornerRadius: FLRadius.button).stroke(FateTheme.line, lineWidth: 0.7))
            .opacity(!isEnabled ? 0.4 : configuration.isPressed ? 0.65 : 1)
    }
}
