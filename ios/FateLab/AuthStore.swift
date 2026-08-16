import Foundation
import Combine

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var session: Session?
    @Published var isWorking = false
    @Published var errorMessage: String?
    private let account = "primary"

    init() {
        if let data = KeychainStore.read(account: account) {
            session = try? JSONDecoder().decode(Session.self, from: data)
        }
    }

    var userID: UUID? { session?.user.id }

    func signIn(email: String, password: String) async {
        await authenticate(path: "/auth/v1/token?grant_type=password", body: ["email": email, "password": password])
    }

    func signUp(email: String, password: String) async {
        await authenticate(path: "/auth/v1/signup", body: ["email": email, "password": password])
    }

    private func authenticate(path: String, body: [String: String]) async {
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            var request = URLRequest(url: AppConfig.supabaseURL.appending(path: path))
            request.httpMethod = "POST"
            request.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
                let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["msg"] as? String
                throw NSError(domain: "FateLabAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: message ?? "ログインできませんでした"])
            }
            let newSession = try JSONDecoder().decode(Session.self, from: data)
            try persist(newSession)
        } catch { errorMessage = error.localizedDescription }
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
