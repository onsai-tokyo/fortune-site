import SwiftUI
import AuthenticationServices

struct AuthView: View {
    var allowsDismissal = true
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var registering = false
    @State private var resendCooldown = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("FATE LAB · MEMBER").font(.caption).tracking(1).foregroundStyle(FateTheme.gold)
                    Text(registering ? "新規登録（無料）" : "ログイン").font(.system(size: 31, weight: .medium, design: .serif))
                    Text("鑑定書と質問の内容を安全に保存します。先ほどの鑑定内容もそのまま引き継げます。")
                        .foregroundStyle(FateTheme.muted).lineSpacing(6)
                    SignInWithAppleButton(.continue) { request in
                        auth.prepareAppleSignIn(request)
                    } onCompletion: { result in
                        Task {
                            await auth.completeAppleSignIn(result)
                            if auth.session != nil { dismiss() }
                        }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .disabled(auth.isWorking)
                    Button {
                        Task {
                            await auth.signInWithGoogle()
                            if auth.session != nil { dismiss() }
                        }
                    } label: {
                        Label("Googleで続ける", systemImage: "globe")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(auth.isWorking)
                    .buttonStyle(OutlineGoldButtonStyle())
                    Divider().overlay(FateTheme.line)
                    Text("またはメールアドレスで続ける")
                        .font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
                    TextField("メールアドレス", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                        .textFieldStyle(.roundedBorder)
                    SecureField("パスワード（8文字以上）", text: $password).textFieldStyle(.roundedBorder)
                    if let message = auth.noticeMessage {
                        Text(message).foregroundStyle(FateTheme.gold).font(.footnote).lineSpacing(4)
                    }
                    if let message = auth.errorMessage { Text(message).foregroundStyle(.red).font(.footnote) }
                    if registering {
                        Button(resendCooldown > 0 ? "再送まで \(resendCooldown)秒" : "確認メールを再送する") {
                            Task {
                                await auth.resendConfirmation(email: email)
                                if auth.errorMessage == nil { resendCooldown = 60 }
                            }
                        }
                        .disabled(auth.isWorking || email.isEmpty || resendCooldown > 0)
                        .task(id: resendCooldown) {
                            guard resendCooldown > 0 else { return }
                            try? await Task.sleep(for: .seconds(1))
                            resendCooldown -= 1
                        }
                    }
                    Button(registering ? "登録する" : "ログイン") {
                        Task {
                            if registering { await auth.signUp(email: email, password: password) }
                            else { await auth.signIn(email: email, password: password) }
                            if auth.session != nil { dismiss() }
                        }
                    }.buttonStyle(GoldButtonStyle()).disabled(auth.isWorking || email.isEmpty || password.count < 8)
                    Divider().overlay(FateTheme.line)
                    Text(registering ? "すでに登録済みの方" : "はじめての方")
                        .font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
                    Button(registering ? "ログイン画面へ" : "新規登録（無料）") {
                        registering.toggle()
                        auth.errorMessage = nil
                        auth.noticeMessage = nil
                    }
                        .buttonStyle(OutlineGoldButtonStyle())
                }.padding(28)
            }.background(FateTheme.ivory).toolbar {
                if allowsDismissal {
                    ToolbarItem(placement: .cancellationAction) { Button("閉じる", systemImage: "xmark") { dismiss() } }
                }
            }
        }
    }
}
