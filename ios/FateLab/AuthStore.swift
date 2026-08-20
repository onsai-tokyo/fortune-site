import Foundation
import Combine
import AuthenticationServices
import CryptoKit
import Supabase

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var session: Session?
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var noticeMessage: String?
    private let account = "primary"
    private var refreshTask: Task<Session, Error>?
    private let callbackURL = URL(string: "fatelab://auth/callback")!
    private var appleNonce: String?
    private lazy var supabase = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey,
        options: SupabaseClientOptions(auth: .init(flowType: .pkce))
    )

    init() {
        if let data = KeychainStore.read(account: account) {
            session = try? JSONDecoder().decode(Session.self, from: data)
        }
    }

    var userID: UUID? { session?.user.id }

    func signIn(email: String, password: String) async {
        await authenticate(path: "/auth/v1/token?grant_type=password", body: ["email": email, "password": password], isRegistration: false)
    }

    func signUp(email: String, password: String) async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer { isWorking = false }
        do {
            let response = try await supabase.auth.signUp(
                email: email,
                password: password,
                redirectTo: callbackURL
            )
            if let sdkSession = response.session {
                try persist(session(from: sdkSession))
            } else {
                noticeMessage = "確認メールを送信しました。メール内のリンクを開いてください。迷惑メールフォルダもご確認ください。"
            }
        } catch {
            errorMessage = localizedAuthError(error.localizedDescription, isRegistration: true)
        }
    }

    func signInWithGoogle() async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer { isWorking = false }
        do {
            let sdkSession = try await supabase.auth.signInWithOAuth(
                provider: .google,
                redirectTo: callbackURL
            )
            try persist(session(from: sdkSession))
            noticeMessage = "Googleでログインしました。"
        } catch {
            if (error as NSError).code != 1 {
                errorMessage = localizedAuthError(error.localizedDescription, isRegistration: false)
            }
        }
    }

    func prepareAppleSignIn(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = UUID().uuidString
        appleNonce = nonce
        request.requestedScopes = [.email, .fullName]
        request.nonce = SHA256.hash(data: Data(nonce.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    func completeAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer {
            isWorking = false
            appleNonce = nil
        }
        do {
            let authorization = try result.get()
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = appleNonce else {
                throw authError("Appleの認証情報を読み取れませんでした。もう一度お試しください。")
            }
            let sdkSession = try await supabase.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: idToken,
                    nonce: nonce
                )
            )
            try persist(session(from: sdkSession))
            noticeMessage = "Appleでログインしました。"
        } catch {
            if (error as NSError).code != ASAuthorizationError.canceled.rawValue {
                errorMessage = localizedAuthError(error.localizedDescription, isRegistration: false)
            }
        }
    }

    func validAccessToken(forceRefresh: Bool = false) async throws -> String {
        guard let session else { throw authError("ログインが必要です。") }
        if !forceRefresh, session.expiresAt > Date().timeIntervalSince1970 + 60 {
            return session.accessToken
        }
        if let refreshTask { return (try await refreshTask.value).accessToken }

        let task = Task { @MainActor [refreshToken = session.refreshToken] in
            var request = URLRequest(url: try self.supabaseEndpoint("/auth/v1/token?grant_type=refresh_token"))
            request.httpMethod = "POST"
            request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
            let newSession: Session = try await self.sessionResponse(for: request, isRegistration: false)
            try self.persist(newSession)
            return newSession
        }
        refreshTask = task
        defer { refreshTask = nil }
        do {
            return (try await task.value).accessToken
        } catch {
            signOut()
            AuthPresentation.shared.isPresented = true
            throw error
        }
    }

    func handleAuthCallback(_ url: URL) async {
        guard url.scheme == "fatelab", url.host == "auth", url.path == "/callback" else { return }
        do {
            let parameters = callbackParameters(url)
            if let message = parameters["error_description"] ?? parameters["error"] {
                throw authError(message.removingPercentEncoding ?? message)
            }
            guard let code = parameters["code"], !code.isEmpty else {
                throw authError("確認リンクを読み取れませんでした。もう一度お試しください。")
            }
            let sdkSession = try await supabase.auth.exchangeCodeForSession(authCode: code)
            try persist(session(from: sdkSession))
            noticeMessage = "ログインしました。"
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func resendConfirmation(email: String) async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer { isWorking = false }
        do {
            var request = URLRequest(url: AppConfig.supabaseURL.appending(path: "/auth/v1/resend"))
            request.httpMethod = "POST"
            request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "type": "signup", "email": email, "redirect_to": "fatelab://auth/callback",
            ])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
                let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                throw authError(localizedAuthError(payload?["message"] as? String, isRegistration: true))
            }
            noticeMessage = "確認メールを再送しました。迷惑メールフォルダもご確認ください。"
        } catch { errorMessage = error.localizedDescription }
    }

    private func authenticate(path: String, body: [String: String], isRegistration: Bool) async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer { isWorking = false }
        do {
            var request = URLRequest(url: try supabaseEndpoint(path))
            request.httpMethod = "POST"
            request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode,
               let newSession = try? JSONDecoder().decode(Session.self, from: data) {
                try persist(newSession)
                return
            }
            if let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode, isRegistration,
               let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               payload["user"] != nil || payload["id"] != nil {
                noticeMessage = "確認メールを送信しました。メール内のリンクを開いてください。迷惑メールフォルダもご確認ください。"
                return
            }
            guard let http = response as? HTTPURLResponse else { throw authError("認証サーバーから正しい応答を受け取れませんでした。") }
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rawMessage = ["msg", "message", "error_description", "error"].compactMap { payload?[$0] as? String }.first
            throw NSError(domain: "FateLabAuth", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: localizedAuthError(rawMessage, isRegistration: isRegistration)])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func localizedAuthError(_ message: String?, isRegistration: Bool) -> String {
        let raw = message?.lowercased() ?? ""
        if raw.contains("invalid login credentials") { return "メールアドレスまたはパスワードが正しくありません。" }
        if raw.contains("email not confirmed") { return "メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてください。" }
        if raw.contains("already registered") || raw.contains("user already") { return "このメールアドレスは登録済みです。ログイン画面からお進みください。" }
        if raw.contains("password") { return "パスワードは8文字以上で入力してください。" }
        if raw.contains("rate limit") { return "試行回数が多くなっています。少し時間を置いてからお試しください。" }
        if let message, !message.isEmpty { return message }
        return isRegistration ? "登録できませんでした。もう一度お試しください。" : "ログインできませんでした。もう一度お試しください。"
    }

    func signOut() {
        session = nil
        KeychainStore.delete(account: account)
    }

    func deleteAccount() async -> Bool {
        guard session != nil else { return false }
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            try await APIClient.shared.deleteAccount(auth: self)
            signOut()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func persist(_ newSession: Session) throws {
        session = newSession
        try KeychainStore.save(JSONEncoder().encode(newSession), account: account)
    }

    private func session(from sdkSession: Supabase.Session) -> Session {
        Session(
            accessToken: sdkSession.accessToken,
            refreshToken: sdkSession.refreshToken,
            expiresAt: sdkSession.expiresAt,
            user: AppUser(id: sdkSession.user.id, email: sdkSession.user.email)
        )
    }

    private func sessionResponse(for request: URLRequest, isRegistration: Bool) async throws -> Session {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw authError("認証サーバーから正しい応答を受け取れませんでした。") }
        guard 200..<300 ~= http.statusCode else {
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let raw = ["msg", "message", "error_description", "error"].compactMap { payload?[$0] as? String }.first
            throw NSError(domain: "FateLabAuth", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: localizedAuthError(raw, isRegistration: isRegistration)])
        }
        return try JSONDecoder().decode(Session.self, from: data)
    }

    private func callbackParameters(_ url: URL) -> [String: String] {
        let raw = [url.query, url.fragment].compactMap { $0 }.joined(separator: "&")
        var components = URLComponents(); components.query = raw
        return Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap {
            guard let value = $0.value else { return nil }; return ($0.name, value)
        })
    }

    private func authError(_ message: String) -> NSError {
        NSError(domain: "FateLabAuth", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func supabaseEndpoint(_ path: String) throws -> URL {
        guard let url = URL(string: path, relativeTo: AppConfig.supabaseURL)?.absoluteURL else {
            throw authError("認証サーバーのURLが正しくありません。")
        }
        return url
    }
}
