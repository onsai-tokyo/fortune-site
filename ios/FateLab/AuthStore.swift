import Foundation
import Combine
import AuthenticationServices
import CryptoKit
import Supabase

@MainActor
final class AuthStore: ObservableObject {
    var onSessionCleared: (() -> Void)?
    @Published private(set) var session: Session?
    @Published var isWorking = false
    @Published private(set) var isDeletingAccount = false
    @Published var errorMessage: String?
    @Published var noticeMessage: String?
    private let account = "primary"
    private var refreshTask: Task<Session, Error>?
    private var refreshID: UUID?
    private let callbackURL = URL(string: "fatelab://auth/callback")!
    private let pendingAppleNameAccount = "pending.apple.name"
    private var appleNonce: String?
    enum State { case restoring, authenticated, temporarilyUnavailable, signedOut, reauthenticationRequired }
    @Published private(set) var state: State = .restoring
    @Published private(set) var authEpoch: UInt64 = 0
    private var adapter: AuthSessionAdapter
    private let webFlow = AuthWebFlow()
    private let readLegacy: () -> Data?
    private let removeLegacy: () throws -> Void
    private var restoreTask: Task<Void, Never>?
    private var consumedCodes = Set<String>()
    private var oauthInProgress = false
    private var cleanupFailed = false
    private var supabase: SupabaseClient { adapter.client }

    init(adapter: AuthSessionAdapter = AuthSessionAdapter(),
         readLegacy: @escaping () -> Data? = { AppConfig.internalCheck ? nil : KeychainStore.read(account: "primary") },
         removeLegacy: @escaping () throws -> Void = { if !AppConfig.internalCheck { try KeychainStore.remove(account: "primary") } }) {
        self.adapter = adapter; self.readLegacy = readLegacy; self.removeLegacy = removeLegacy
        restoreTask = Task { await performRestore() }
    }

    func restore() async { await restoreTask?.value }

    private func performRestore() async {
        let epoch = authEpoch
        let owner = adapter
        guard AppConfig.authenticationConfigurationIsValid else {
            state = .temporarilyUnavailable
            errorMessage = "認証設定を読み込めませんでした。アプリの更新を確認してください。"
            return
        }
        do {
            try owner.storage.check()
            let legacyData = readLegacy()
            let legacyHash = legacyData.map { Data(SHA256.hash(data: $0)) }
            let migratedHash = try owner.storage.retrieve(key: AuthSessionAdapter.legacyMigrationKey)
            if let data = legacyData, migratedHash != legacyHash {
                // The old application used primary for the currently displayed account.
                // An older SDK OAuth account must not supersede a later email login.
                let legacy = try JSONDecoder().decode(Session.self, from: data)
                let migrated = try await owner.client.auth.setSession(accessToken: legacy.accessToken, refreshToken: legacy.refreshToken)
                guard epoch == authEpoch else { throw CancellationError() }
                guard migrated.user.id == legacy.user.id else {
                    cleanupFailed = true
                    try owner.storage.retire(removing: AuthSessionAdapter.storageKey)
                    throw authError("保存済みアカウントを確認できません。ログアウトして再度ログインしてください。")
                }
                session = try owner.checked(migrated)
                // A receipt contains no tokens. If deletion fails, next launch uses the
                // successfully persisted SDK session instead of replaying an old refresh.
                try owner.storage.store(key: AuthSessionAdapter.legacyMigrationKey, value: legacyHash!)
                try removeLegacy()
            } else if let current = owner.client.auth.currentSession {
                session = try owner.checked(current)
                if legacyData != nil { try removeLegacy() }
            }
            try owner.storage.check()
            guard epoch == authEpoch else { return }
            if session != nil { _ = try await validAccessToken() }
            else { state = .signedOut }
        } catch {
            guard epoch == authEpoch else { return }
            record(error)
            // Restoration is automatic, not a failed login attempt. Preserve the
            // recoverable state and explain it separately from submitted form errors.
            guard !cleanupFailed else { return }
            noticeMessage = Self.isInvalidSession(error)
                ? Self.reauthenticationMessage
                : "前回のログイン状態を確認できませんでした。もう一度ログインしてください。"
            errorMessage = nil
        }
    }

    private func record(_ error: Error) {
        if Self.isCancellation(error) { return }
        if Self.isInvalidSession(error) {
            state = .reauthenticationRequired
        } else { state = .temporarilyUnavailable }
        errorMessage = Self.message(error)
    }

    private static let reauthenticationMessage = "ログインの有効期限が切れました。もう一度ログインしてください。"

    private static func isInvalidSession(_ error: Error) -> Bool {
        guard let auth = error as? AuthError else { return false }
        return ["session_missing", "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used"].contains(auth.errorCode.rawValue)
    }

    static func isCancellation(_ error: Error) -> Bool {
        let ns = error as NSError
        return error is CancellationError ||
            (ns.domain == ASWebAuthenticationSessionError.errorDomain && ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue) ||
            (ns.domain == ASAuthorizationError.errorDomain && ns.code == ASAuthorizationError.canceled.rawValue)
    }

    static func message(_ error: Error) -> String {
        if isInvalidSession(error) { return reauthenticationMessage }
        if error is URLError { return "通信できません。接続を確認して再試行してください。" }
        if let auth = error as? AuthError {
            switch auth.errorCode.rawValue {
            case "invalid_credentials": return "メールアドレスまたはパスワードが正しくありません。"
            case "email_not_confirmed": return "メールアドレスの確認が必要です。確認メールのリンクを開いてください。"
            case "over_request_rate_limit", "over_email_send_rate_limit": return "試行回数が多くなっています。少し時間を置いてお試しください。"
            case "flow_state_not_found", "flow_state_expired", "bad_code_verifier", "otp_expired": return "確認リンクが無効か期限切れです。この端末から確認メールを再送してください。"
            default: break
            }
        }
        if (error as NSError).domain == "FateLabAuthCallback" { return AuthCallback.invalid().localizedDescription }
        return "認証を完了できませんでした。時間を置いて再試行してください。"
    }

    private func beginAuthentication() async -> Bool {
        await restoreTask?.value
        guard !isWorking, !cleanupFailed else { return false }
        guard AppConfig.authenticationConfigurationIsValid else {
            errorMessage = "認証設定を読み込めませんでした。アプリの更新を確認してください。"
            return false
        }
        // An explicit new login must not share a session manager with an old refresh.
        if session != nil { signOut() }
        guard !cleanupFailed else { return false }
        isWorking = true; errorMessage = nil; noticeMessage = nil
        return true
    }

    var userID: UUID? { session?.user.id }

    func signIn(email: String, password: String) async {
        guard await beginAuthentication() else { return }
        let epoch = authEpoch; let owner = adapter
        defer { if epoch == authEpoch { isWorking = false } }
        do {
            let value = try await owner.client.auth.signIn(email: email, password: password)
            guard epoch == authEpoch else { return }
            try persist(owner.checked(value))
        } catch { if epoch == authEpoch { record(error) } }
    }

    func signUp(email: String, password: String) async {
        guard await beginAuthentication() else { return }
        let epoch = authEpoch; let owner = adapter
        defer { if epoch == authEpoch { isWorking = false } }
        do {
            let response = try await supabase.auth.signUp(
                email: email,
                password: password,
                redirectTo: callbackURL
            )
            guard epoch == authEpoch else { return }
            if let sdkSession = response.session {
                guard epoch == authEpoch else { return }
                try persist(owner.checked(sdkSession))
            } else {
                noticeMessage = "登録可能な場合は確認メールが届きます。メールをご確認ください。"
            }
        } catch { if epoch == authEpoch { record(error) } }
    }

    func signInWithGoogle() async {
        guard await beginAuthentication() else { return }
        let epoch = authEpoch; let owner = adapter
        defer { if epoch == authEpoch { isWorking = false } }
        oauthInProgress = true
        defer { if epoch == authEpoch { oauthInProgress = false } }
        var stage = GoogleStage.prepare
        do {
            let url = try owner.client.auth.getOAuthSignInURL(provider: .google, redirectTo: callbackURL)
            try owner.storage.check()
            stage = .browser
            let result = try await webFlow.launch(url)
            guard epoch == authEpoch else { throw CancellationError() }
            stage = .callback
            let code = try consumeCallback(result)
            stage = .exchange
            let sdkSession = try await owner.client.auth.exchangeCodeForSession(authCode: code)
            guard epoch == authEpoch else { return }
            stage = .storage
            try persist(owner.checked(sdkSession))
            noticeMessage = "Googleでログインしました。"
        } catch {
            if epoch == authEpoch, !Self.isCancellation(error) {
                record(error)
                errorMessage = Self.googleMessage(error, stage: stage)
            }
        }
    }

    enum GoogleStage: String { case prepare = "G01", browser = "G02", callback = "G03", exchange = "G04", storage = "G05" }

    static func googleMessage(_ error: Error, stage: GoogleStage) -> String {
        let category: String
        let ns = error as NSError
        if error is DecodingError { category = "decode" }
        else if error is URLError { category = "network" }
        else if ns.domain == "FateLabAuthCallback" { category = "callback" }
        else if ns.domain == "FateLabAuthStorage" || ns.domain == NSOSStatusErrorDomain { category = "storage" }
        else if ns.domain == ASWebAuthenticationSessionError.errorDomain { category = "browser" }
        else if let auth = error as? AuthError {
            let known = ["flow_state_not_found", "flow_state_expired", "bad_code_verifier", "bad_oauth_state", "bad_oauth_callback", "unexpected_failure", "validation_failed", "session_not_found", "over_request_rate_limit"]
            category = known.contains(auth.errorCode.rawValue) ? auth.errorCode.rawValue : "auth"
        } else { category = "other" }
        // Arbitrary server messages, callback URLs and tokens must never enter the diagnostic.
        return "Googleログインを完了できませんでした。もう一度Googleログインをお試しください。（確認コード：\(stage.rawValue)-\(category)）"
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
        // Ignore unsolicited or duplicate UI callbacks; only a requested Apple flow owns a nonce.
        guard appleNonce != nil else { return }
        guard await beginAuthentication() else { return }
        let epoch = authEpoch; let owner = adapter
        defer { if epoch == authEpoch { isWorking = false; appleNonce = nil } }
        do {
            let authorization = try result.get()
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let codeData = credential.authorizationCode,
                  let authorizationCode = String(data: codeData, encoding: .utf8),
                  let nonce = appleNonce else {
                throw authError("Appleの認証情報を読み取れませんでした。もう一度お試しください。")
            }
            let nameAccount = pendingAppleNameAccount + "." + credential.user
            if let fullName = credential.fullName {
                let formatted = PersonNameComponentsFormatter().string(from: fullName)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !formatted.isEmpty {
                    do { try KeychainStore.save(Data(formatted.utf8), account: nameAccount) }
                    catch { noticeMessage = "名前を保存できませんでした。ログイン後にプロフィールで設定できます。" }
                }
            }
            let sdkSession = try await supabase.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: idToken,
                    nonce: nonce
                )
            )
            guard epoch == authEpoch else { return }
            try persist(owner.checked(sdkSession))
            noticeMessage = "Appleでログインしました。"
            if let nameData = KeychainStore.read(account: nameAccount),
               let fullName = String(data: nameData, encoding: .utf8), !fullName.isEmpty {
                do {
                    _ = try await owner.client.auth.update(user: UserAttributes(data: ["full_name": .string(fullName)]))
                    guard epoch == authEpoch else { return }
                    KeychainStore.delete(account: nameAccount)
                } catch {
                    guard epoch == authEpoch else { return }
                    noticeMessage = "ログインしました。名前の保存は次回ログイン時に再試行します。"
                }
            }
            if AppConfig.authenticationCheckOnly {
                noticeMessage = "Appleでログインしました。確認版ではアプリサーバーへの連携情報保存は行いません。"
                return
            }
            do { try await APIClient.shared.retainAppleSignInToken(authorizationCode: authorizationCode, auth: self) }
            catch { if epoch == authEpoch { noticeMessage = "ログインしました。Apple連携情報の保存に失敗しました。次回Appleログイン時に再試行します。" } }

        } catch {
            if epoch == authEpoch { record(error) }
        }
    }

    func validAccessToken(forceRefresh: Bool = false) async throws -> String {
        guard let session, state != .reauthenticationRequired, !cleanupFailed else { throw authError("ログインが必要です。") }
        if !forceRefresh, session.expiresAt > Date().timeIntervalSince1970 + 60 {
            state = .authenticated
            return session.accessToken
        }
        let epoch = authEpoch; let user = session.user.id; let owner = adapter
        let task: Task<Session, Error>
        if let refreshTask { task = refreshTask }
        else {
            task = Task { @MainActor in
                let refreshed = try await owner.client.auth.refreshSession()
                try Task.checkCancellation()
                return try owner.checked(refreshed)
            }
            refreshTask = task; refreshID = UUID()
        }
        let operationID = refreshID
        defer { if epoch == authEpoch, refreshID == operationID { refreshTask = nil; refreshID = nil } }
        do {
            let refreshed = try await task.value
            guard epoch == authEpoch, userID == user, refreshed.user.id == user else { throw CancellationError() }
            try persist(refreshed)
            return refreshed.accessToken
        } catch {
            if epoch == authEpoch {
                record(error)
                if !isWorking {
                    noticeMessage = Self.isInvalidSession(error) ? Self.reauthenticationMessage : "接続を確認できませんでした。もう一度お試しください。"
                    errorMessage = nil
                }
            }
            throw error
        }
    }

    func requireReauthentication() {
        state = .reauthenticationRequired
        errorMessage = Self.reauthenticationMessage
        AuthPresentation.shared.isPresented = true
    }

    private func consumeCallback(_ url: URL) throws -> String {
        let code = try AuthCallback.code(from: url)
        let digest = SHA256.hash(data: Data(code.utf8)).map { String(format: "%02x", $0) }.joined()
        guard consumedCodes.count < 256, consumedCodes.insert(digest).inserted else { throw AuthCallback.invalid() }
        return code
    }

    func handleAuthCallback(_ url: URL) async {
        guard url.scheme == "fatelab", url.host == "auth", url.path == "/callback" else { return }
        // ASWebAuthenticationSession owns the OAuth code exchange while it is active.
        guard !oauthInProgress, !isWorking, !cleanupFailed else { return }
        await restoreTask?.value
        guard session == nil else { return }
        let epoch = authEpoch; let owner = adapter
        do {
            let code = try consumeCallback(url)
            let sdkSession = try await owner.client.auth.exchangeCodeForSession(authCode: code)
            guard epoch == authEpoch else { return }
            try persist(owner.checked(sdkSession))
            noticeMessage = "ログインしました。"; errorMessage = nil
        } catch { if epoch == authEpoch { record(error) } }
    }

    func resendConfirmation(email: String) async {
        guard await beginAuthentication() else { return }
        let epoch = authEpoch; let owner = adapter
        defer { if epoch == authEpoch { isWorking = false } }
        do {
            try await owner.client.auth.resend(email: email, type: .signup, emailRedirectTo: callbackURL)
            guard epoch == authEpoch else { return }
            noticeMessage = "登録可能な場合は確認メールが届きます。メールをご確認ください。"
        } catch { if epoch == authEpoch { record(error) } }
    }

    func signOut() {
        authEpoch &+= 1
        webFlow.cancel()
        restoreTask?.cancel(); refreshTask?.cancel(); refreshTask = nil
        let old = adapter
        // Revoke writes synchronously before any suspended SDK operation can return.
        do {
            try old.storage.retire(removing: AuthSessionAdapter.storageKey)
            try removeLegacy()
            cleanupFailed = false
        } catch { cleanupFailed = true; errorMessage = "ログアウト情報を保存できませんでした。再度ログアウトしてください。" }
        Task { try? await old.client.auth.signOut(scope: .local) }
        if !cleanupFailed { adapter = AuthSessionAdapter() }
        session = nil; state = .signedOut; isWorking = false; isDeletingAccount = false; oauthInProgress = false
        clearLocalUserState(); onSessionCleared?()
    }

    private func clearLocalUserState() {
        // The account-scoped view tree is discarded on identity/epoch changes.
        // Keep persisted drafts for their original owner; do not erase all users.
        AuthPresentation.shared.isPresented = false
    }

    func deleteAccount(api: APIClient = .shared) async -> Bool {
        let owner = AccountScope(self)
        guard session != nil, !isWorking, !isDeletingAccount else { return false }
        isWorking = true; isDeletingAccount = true; errorMessage = nil
        defer { if owner.isCurrent(self) { isWorking = false; isDeletingAccount = false } }
        do {
            try await api.deleteAccount(auth: self)
            try owner.check(self)
            signOut()
            return true
        } catch {
            if owner.isCurrent(self) { errorMessage = userFacingErrorMessage(error) }
            return false
        }
    }

    private func persist(_ newSession: Session) throws {
        try adapter.storage.check()
        if let old = session, old.user.id != newSession.user.id {
            authEpoch &+= 1; isWorking = false; oauthInProgress = false
            clearLocalUserState(); onSessionCleared?()
        }
        session = newSession; state = .authenticated
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
