import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var session: Session?
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var noticeMessage: String?
    private let account = "primary"

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
        await authenticate(path: "/auth/v1/signup", body: ["email": email, "password": password], isRegistration: true)
    }

    private func authenticate(path: String, body: [String: String], isRegistration: Bool) async {
        isWorking = true; errorMessage = nil; noticeMessage = nil
        defer { isWorking = false }
        do {
            var request = URLRequest(url: AppConfig.supabaseURL.appending(path: path))
            request.httpMethod = "POST"
            request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw NSError(domain: "FateLabAuth", code: 0, userInfo: [
                    NSLocalizedDescriptionKey: "認証サーバーから正しい応答を受け取れませんでした。"
                ])
            }
            guard 200..<300 ~= http.statusCode else {
                let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                let rawMessage = ["msg", "message", "error_description", "error"]
                    .compactMap { payload?[$0] as? String }.first
                throw NSError(domain: "FateLabAuth", code: http.statusCode, userInfo: [
                    NSLocalizedDescriptionKey: localizedAuthError(rawMessage, isRegistration: isRegistration)
                ])
            }
            if let newSession = try? JSONDecoder().decode(Session.self, from: data) {
                try persist(newSession)
                return
            }
            if isRegistration,
               let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               payload["user"] != nil || payload["id"] != nil {
                noticeMessage = "確認メールを送信しました。メール内のリンクを開いたあと、この画面の「ログイン画面へ」からログインしてください。"
                return
            }
            throw NSError(domain: "FateLabAuth", code: 2, userInfo: [
                NSLocalizedDescriptionKey: isRegistration
                    ? "登録結果を確認できませんでした。すでに登録済みの場合は、ログイン画面をお試しください。"
                    : "ログイン情報を確認できませんでした。もう一度お試しください。"
            ])
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
        guard let token = session?.accessToken else { return false }
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            try await APIClient.shared.deleteAccount(token: token)
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
}
