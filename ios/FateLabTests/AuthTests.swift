import XCTest
import Supabase
import AuthenticationServices
import SwiftUI
import UIKit
import Vision
@testable import FateLab

final class MemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
    let lock = NSLock()
    var values: [String: Data] = [:]
    var failWrites = false
    func store(key: String, value: Data) throws {
        try lock.withLock { if failWrites { throw URLError(.cannotWriteToFile) }; values[key] = value }
    }
    func retrieve(key: String) throws -> Data? { lock.withLock { values[key] } }
    func remove(key: String) throws { lock.withLock { values[key] = nil } }
}

final class AuthTests: XCTestCase {
    func testDefaultAuthStorageTreatsAbsentKeyAsSignedOut() throws {
        // Use a unique account in the real simulator Keychain; never read a real session.
        let storage = AuthSessionStorage()
        let key = "fatelab-missing-test-\(UUID().uuidString)"
        XCTAssertNil(try storage.retrieve(key: key))
        XCTAssertNoThrow(try storage.check())
        XCTAssertNoThrow(try storage.remove(key: key))
        XCTAssertNoThrow(try storage.check())
    }
    func testAuthenticationCheckRejectsApplicationAPIs() {
        XCTAssertThrowsError(try AppConfig.requireApplicationAPI(authCheckOnly: true))
        XCTAssertNoThrow(try AppConfig.requireApplicationAPI(authCheckOnly: false))
    }

    func testEndpointConfigurationFailsClosed() {
        for raw: String? in [nil, "", "$(API_BASE_URL)", "http://example.test", "https://invalid.supabase.co",
                             "https://invalid.invalid", "https://user:secret@example.test", "https://example.test?token=x",
                             "https://example.test/path", "https://example.test#x", " https://example.test"] {
            XCTAssertNil(AppConfig.endpoint(raw), "Invalid configuration must not select a fallback")
        }
        XCTAssertEqual(AppConfig.endpoint("https://isolated.example.test")?.host, "isolated.example.test")
    }

    func testReportRetryKeepsOperationAndRawVersionMetadata() {
        let report = GeneratedReport(birthData: [:], calculatedData: [:], text: "body", structuredSnapshot: ["generatorVersion": "synthetic-v1"])
        var copy = report
        copy.conversationID = UUID()
        XCTAssertEqual(copy.saveOperationID, report.saveOperationID)
        XCTAssertEqual(copy.structuredSnapshot?["generatorVersion"] as? String, "synthetic-v1")
        XCTAssertNotEqual(report.saveOperationID, GeneratedReport(birthData: [:], calculatedData: [:], text: "body").saveOperationID)
    }

    func testCallbackRejectsAmbiguityAndTokens() throws {
        XCTAssertEqual(try AuthCallback.code(from: URL(string: "fatelab://auth/callback?code=good")!), "good")
        for suffix in ["?code=a&code=b", "?code=a#code=b", "?code=a&error=bad", "?code", "#code=a", "?access_token=a", "?code=a#refresh_token=b", "?%63ode=a&code=b"] {
            XCTAssertThrowsError(try AuthCallback.code(from: URL(string: "fatelab://auth/callback" + suffix)!))
        }
        XCTAssertThrowsError(try AuthCallback.code(from: URL(string: "https://auth/callback?code=a")!))
    }
    func testRetiredSDKCannotOverwriteNewSession() throws {
        let base = MemoryAuthStorage(), key = "test"
        let old = AuthSessionStorage(base: base)
        try old.store(key: key, value: Data("A".utf8))
        try old.retire(removing: key)
        let new = AuthSessionStorage(base: base)
        try new.store(key: key, value: Data("B".utf8))
        XCTAssertThrowsError(try old.store(key: key, value: Data("late-A".utf8)))
        try old.remove(key: key)
        XCTAssertEqual(try new.retrieve(key: key), Data("B".utf8))
    }
    func testStorageFailureRemainsObservableWhenSDKSwallowsIt() throws {
        let base = MemoryAuthStorage(); base.failWrites = true
        let storage = AuthSessionStorage(base: base)
        try? storage.store(key: "test", value: Data())
        XCTAssertThrowsError(try storage.check())
    }
    @MainActor func testCancellationRequiresDomain() {
        XCTAssertFalse(AuthStore.isCancellation(NSError(domain: "unrelated", code: 1)))
        XCTAssertTrue(AuthStore.isCancellation(NSError(domain: ASWebAuthenticationSessionError.errorDomain, code: ASWebAuthenticationSessionError.canceledLogin.rawValue)))
        XCTAssertTrue(AuthStore.isCancellation(CancellationError()))
        XCTAssertTrue(AuthStore.message(URLError(.notConnectedToInternet)).contains("通信"))
    }

    @MainActor func testGoogleDiagnosticIdentifiesStageWithoutExposingErrorPayload() {
        let secret = "fatelab://auth/callback?code=secret-code&access_token=secret-token"
        let unknown = NSError(domain: secret, code: 42, userInfo: [NSLocalizedDescriptionKey: secret])
        XCTAssertTrue(AuthStore.googleMessage(unknown, stage: .exchange).contains("G04-other"))
        let decoding = DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: secret))
        XCTAssertTrue(AuthStore.googleMessage(decoding, stage: .exchange).contains("G04-decode"))
        XCTAssertTrue(AuthStore.googleMessage(NSError(domain: "FateLabAuthStorage", code: 1), stage: .storage).contains("G05-storage"))
        for error in [unknown as Error, decoding, URLError(.notConnectedToInternet), AuthCallback.invalid()] {
            let message = AuthStore.googleMessage(error, stage: .exchange)
            XCTAssertFalse(message.contains("secret"))
            XCTAssertFalse(message.contains("fatelab://"))
            XCTAssertFalse(message.contains("確認メール"))
        }
    }
}

final class AuthURLProtocol: URLProtocol, @unchecked Sendable {
    static let state = TransportState()
    final class TransportState: @unchecked Sendable {
        let lock = NSLock()
        var response = Data()
        var status = 200
        var error: Error?
        var calls = 0
        var delay: TimeInterval = 0
        func configure(_ data: Data, status: Int = 200, error: Error? = nil, delay: TimeInterval = 0) {
            lock.withLock { self.response = data; self.status = status; self.error = error; self.calls = 0; self.delay = delay }
        }
    }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (body, status, error, delay) = Self.state.lock.withLock {
            // SDK local logout performs its own remote revoke request. Count
            // business/token calls separately so its asynchronous completion
            // cannot contaminate the following test's request assertion.
            if !request.url!.path.hasSuffix("/logout") { Self.state.calls += 1 }
            return (Self.state.response, Self.state.status, Self.state.error, Self.state.delay)
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [self] in
            if let error { client?.urlProtocol(self, didFailWithError: error); return }
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01"])!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        }
    }
    override func stopLoading() {}
}

@MainActor
final class AuthSDKTests: XCTestCase {
    func testAutomaticRestoreFailureIsNotPresentedAsSubmittedLoginFailure() async {
        let storage = AuthSessionStorage(base: MemoryAuthStorage())
        let adapter = AuthSessionAdapter(storage: storage)
        let auth = AuthStore(adapter: adapter, readLegacy: { Data("invalid saved session".utf8) }, removeLegacy: {})
        await auth.restore()
        XCTAssertNil(auth.session)
        XCTAssertNil(auth.errorMessage)
        XCTAssertEqual(auth.state, .temporarilyUnavailable)
        XCTAssertEqual(auth.noticeMessage, "前回のログイン状態を確認できませんでした。もう一度ログインしてください。")
    }

    func testApplePurchaseVerificationUsesTypedServerAcknowledgement() async throws {
        guard AppConfig.storeKitEnabled else { throw XCTSkip("購入有効構成のAPI試験") }
        let (auth, _) = try setup(); await auth.restore()
        let api = APIClient(transport: streamTransport())
        let owner = try XCTUnwrap(auth.userID)
        StreamURLProtocol.configure([(200, "{\"verified\":true,\"delivery\":\"mirrored\",\"transactionId\":\"synthetic\",\"ownerId\":\"\(owner.uuidString)\"}")])
        let result = try await api.verifyApplePurchase(signedTransaction: "synthetic-jws", auth: auth)
        XCTAssertTrue(result.accepts(transactionID: "synthetic", ownerID: owner))
        XCTAssertEqual(StreamURLProtocol.requests.map(\.url?.path), ["/api/apple/transactions/verify"])
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["POST"])
    }

    func testFlowCheckEnablesApplePurchasesAndMockedServerEntitlement() async throws {
        guard AppConfig.basicFlowCheck else { throw XCTSkip("FlowCheck構成で実行する専用試験") }
        XCTAssertFalse(AppConfig.authenticationCheckOnly)
        XCTAssertTrue(AppConfig.storeKitEnabled)
        XCTAssertNoThrow(try AppConfig.requireApplicationAPI())
        XCTAssertTrue(AuthSessionAdapter.storageKey.hasPrefix("authcheck-"))
        XCTAssertTrue(AccountStorage.key("draft", userID: UUID()).hasPrefix("authcheck."))
        let (auth, _) = try setup(); await auth.restore()
        let api = APIClient(transport: streamTransport())
        let purchases = PurchaseManager(api: api, storeKitEnabled: false)
        for premium in [false, true, false] {
            StreamURLProtocol.configure([(200, "{\"isPremium\":\(premium),\"used\":0,\"limit\":2}")])
            await purchases.sync(auth: auth)
            XCTAssertFalse(purchases.isSyncing)
            XCTAssertEqual(purchases.isPremium, premium)
            XCTAssertEqual(purchases.accessState, premium ? .premium : .standard)
            XCTAssertEqual(StreamURLProtocol.requests.map(\.url?.path), ["/api/reading/status"])
            XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET"])
        }
        StreamURLProtocol.configure([])
        await purchases.load()
        await purchases.purchase(userID: auth.userID!, auth: auth)
        await purchases.restore(auth: auth)
        XCTAssertNil(purchases.product)
        XCTAssertEqual(purchases.errorMessage, AppConfig.purchasesUnavailableMessage)
        XCTAssertNoThrow(try AppConfig.requireStoreKit())
        XCTAssertEqual(StreamURLProtocol.count, 0)
        purchases.resetForAccountChange()
        XCTAssertEqual(purchases.accessState, .unknown)
        XCTAssertFalse(purchases.isSyncing)
    }

    func testPurchaseStatusFailureStopsLoadingAndCanRecover() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let purchases = PurchaseManager(api: APIClient(transport: streamTransport()), storeKitEnabled: false)
        StreamURLProtocol.configure([(422, "{\"error\":\"synthetic unavailable\"}")])
        await purchases.sync(auth: auth)
        XCTAssertEqual(purchases.accessState, .unknown)
        XCTAssertFalse(purchases.isSyncing, "An unavailable entitlement is not an ongoing request")
        XCTAssertNotNil(purchases.errorMessage)
        StreamURLProtocol.configure([(200, "{\"isPremium\":false,\"used\":0,\"limit\":2}")])
        await purchases.sync(auth: auth)
        XCTAssertEqual(purchases.accessState, .standard)
        XCTAssertFalse(purchases.isSyncing)
        XCTAssertNil(purchases.errorMessage)
    }

    func testConcurrentPurchaseStatusChecksShareOneRequest() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let purchases = PurchaseManager(api: APIClient(transport: URLSession(configuration: config)), storeKitEnabled: false)
        AuthURLProtocol.state.configure(Data("{\"isPremium\":true,\"used\":0,\"limit\":2}".utf8), delay: 0.2)
        let first = Task { await purchases.sync(auth: auth) }
        let second = Task { await purchases.sync(auth: auth) }
        let third = Task { await purchases.sync(auth: auth) }
        await first.value; await second.value; await third.value
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1,
            "Opening Settings during startup must share the membership lookup")
        XCTAssertEqual(purchases.accessState, .premium)
        XCTAssertFalse(purchases.isSyncing)
    }

    func testPurchaseStatusRefreshKeepsLastServerResultUntilNewResult() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let purchases = PurchaseManager(api: APIClient(transport: URLSession(configuration: config)), storeKitEnabled: false)
        AuthURLProtocol.state.configure(Data("{\"isPremium\":true,\"used\":0,\"limit\":2}".utf8))
        await purchases.sync(auth: auth)
        AuthURLProtocol.state.configure(Data("{\"isPremium\":false,\"used\":0,\"limit\":2}".utf8), delay: 0.2)
        let refresh = Task { await purchases.sync(auth: auth) }
        for _ in 0..<100 where !purchases.isSyncing { await Task.yield() }
        XCTAssertTrue(purchases.isSyncing)
        XCTAssertEqual(purchases.accessState, .premium, "Reopening Settings must not replace a known status with a spinner")
        await refresh.value
        XCTAssertEqual(purchases.accessState, .standard, "Fresh server results must replace previous membership")
        XCTAssertFalse(purchases.isSyncing)
        AuthURLProtocol.state.configure(Data("{}".utf8), status: 422)
        await purchases.sync(auth: auth)
        XCTAssertEqual(purchases.accessState, .unknown, "A failed refresh must never keep granting stale access")
        XCTAssertFalse(purchases.isSyncing)
    }

    func testPurchaseStatusResetRejectsAnOlderInFlightResult() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let purchases = PurchaseManager(api: APIClient(transport: URLSession(configuration: config)), storeKitEnabled: false)
        AuthURLProtocol.state.configure(Data("{\"isPremium\":true,\"used\":0,\"limit\":2}".utf8), delay: 0.2)
        let old = Task { await purchases.sync(auth: auth) }
        for _ in 0..<100 {
            if AuthURLProtocol.state.lock.withLock({ AuthURLProtocol.state.calls }) > 0 { break }
            try await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
        purchases.resetForAccountChange()
        XCTAssertEqual(purchases.accessState, .unknown)
        AuthURLProtocol.state.configure(Data("{\"isPremium\":false,\"used\":0,\"limit\":2}".utf8))
        await purchases.sync(auth: auth)
        await old.value
        XCTAssertEqual(purchases.accessState, .standard)
        XCTAssertFalse(purchases.isSyncing)
        XCTAssertNil(purchases.errorMessage)
    }

    func testAppleIDTokenExchangePersistsAfterFreshKeychainRestore() async throws {
        let base = AuthKeychainStorage(service: "fatelab-apple-test-\(UUID().uuidString)")
        let storage = AuthSessionStorage(base: base)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let client = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false),
                           global: .init(session: URLSession(configuration: config))))
        let adapter = AuthSessionAdapter(storage: storage, client: client)
        let store = AuthStore(adapter: adapter, readLegacy: { nil }, removeLegacy: {})
        defer { try? base.remove(key: AuthSessionAdapter.storageKey) }
        await store.restore()
        XCTAssertNil(store.errorMessage)
        AuthURLProtocol.state.configure(response())
        // The real-device server log returned 200 for id_token. Exercise the SDK
        // response -> real Keychain -> checked-session boundary used by Apple login.
        let session = try await client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: "synthetic-id-token", nonce: "synthetic-nonce"))
        XCTAssertEqual(try adapter.checked(session).user.id, session.user.id)
        XCTAssertNotNil(try base.retrieve(key: AuthSessionAdapter.storageKey))
    }

    func testRepeatedSignupAndResendStayUnauthenticatedWithoutDisclosingAccount() async throws {
        let (store, _) = try setup(seed: false)
        await store.restore()
        let payload = try JSONSerialization.jsonObject(with: response()) as! [String: Any]
        var user = payload["user"] as! [String: Any]
        user["identities"] = []
        AuthURLProtocol.state.configure(try JSONSerialization.data(withJSONObject: user))
        await store.signUp(email: "synthetic@example.invalid", password: "synthetic-password")
        XCTAssertNil(store.session)
        XCTAssertNil(store.errorMessage)
        XCTAssertEqual(store.noticeMessage, "登録可能な場合は確認メールが届きます。メールをご確認ください。")
        AuthURLProtocol.state.configure(Data("{}".utf8))
        await store.resendConfirmation(email: "synthetic@example.invalid")
        XCTAssertNil(store.session)
        XCTAssertNil(store.errorMessage)
        XCTAssertFalse(store.noticeMessage?.contains("送信しました") ?? true)
        AuthURLProtocol.state.configure(Data("{\"code\":\"over_email_send_rate_limit\",\"msg\":\"rate limited\"}".utf8), status: 429)
        await store.resendConfirmation(email: "synthetic@example.invalid")
        XCTAssertNotNil(store.errorMessage)
        XCTAssertNil(store.noticeMessage, "A failed resend must not retain an earlier success notice")
    }

    func testSDKMissingKeyReproducesStartupAndPostExchangeFailure() async throws {
        let service = "fatelab-sdk-regression-\(UUID().uuidString)"
        let cleanup = AuthKeychainStorage(service: service)
        let storage = AuthSessionStorage(base: KeychainLocalStorage(service: service))
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let client = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false),
                           global: .init(session: URLSession(configuration: config))))
        let adapter = AuthSessionAdapter(storage: storage, client: client)
        let store = AuthStore(adapter: adapter, readLegacy: { nil }, removeLegacy: {})
        defer {
            for key in [AuthSessionAdapter.storageKey, AuthSessionAdapter.storageKey + "-code-verifier", AuthSessionAdapter.legacyMigrationKey] {
                try? cleanup.remove(key: key)
            }
        }
        // Compare the old SDK store with the fixed store on the same real Keychain.
        // A missing receipt is normal, but the old adapter permanently latches its error.
        XCTAssertNil(try cleanup.retrieve(key: AuthSessionAdapter.legacyMigrationKey))
        await store.restore()
        XCTAssertEqual(store.state, .temporarilyUnavailable)
        XCTAssertNil(store.errorMessage)
        XCTAssertNotNil(store.noticeMessage)
        _ = try client.auth.getOAuthSignInURL(provider: .google, redirectTo: URL(string: "fatelab://auth/callback")!)
        AuthURLProtocol.state.configure(response())
        let session = try await client.auth.exchangeCodeForSession(authCode: "synthetic-sdk-regression")
        XCTAssertNotNil(try cleanup.retrieve(key: AuthSessionAdapter.storageKey), "The successful exchange really saved the session")
        XCTAssertEqual(client.auth.currentSession?.accessToken, session.accessToken)
        XCTAssertThrowsError(try adapter.checked(session), "The latched missing-item error still prevents app login")
    }

    func testRealKeychainFreshRestorePKCEPersistenceAndLogout() async throws {
        let service = "fatelab-keychain-test-\(UUID().uuidString)"
        let base = AuthKeychainStorage(service: service)
        let storage = AuthSessionStorage(base: base)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let client = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false),
                           global: .init(session: URLSession(configuration: config))))
        let adapter = AuthSessionAdapter(storage: storage, client: client)
        let store = AuthStore(adapter: adapter, readLegacy: { nil }, removeLegacy: {})
        defer {
            for key in [AuthSessionAdapter.storageKey, AuthSessionAdapter.storageKey + "-code-verifier", AuthSessionAdapter.legacyMigrationKey] {
                try? base.remove(key: key)
            }
        }
        await store.restore()
        XCTAssertEqual(store.state, .signedOut)
        XCTAssertNil(store.errorMessage, "Fresh storage must not report an authentication error")
        _ = try client.auth.getOAuthSignInURL(provider: .google, redirectTo: URL(string: "fatelab://auth/callback")!)
        try storage.check()
        AuthURLProtocol.state.configure(response())
        await store.handleAuthCallback(URL(string: "fatelab://auth/callback?code=synthetic-real-keychain")!)
        XCTAssertEqual(store.state, .authenticated)
        XCTAssertNil(store.errorMessage)
        XCTAssertNotNil(store.session)
        // Recreate the SDK with the same real Keychain to exercise startup restore.
        let restoredStorage = AuthSessionStorage(base: AuthKeychainStorage(service: service))
        let restoredClient = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: restoredStorage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false),
                           global: .init(session: URLSession(configuration: config))))
        let restored = AuthStore(adapter: AuthSessionAdapter(storage: restoredStorage, client: restoredClient), readLegacy: { nil }, removeLegacy: {})
        await restored.restore()
        XCTAssertEqual(restored.state, .authenticated)
        XCTAssertEqual(restored.userID, store.userID)
        XCTAssertNil(restored.errorMessage)
        // Receipt/verifier may already be absent; logout must still finish.
        restored.signOut()
        XCTAssertNil(restored.errorMessage)
        XCTAssertEqual(restored.state, .signedOut)
        XCTAssertNil(try base.retrieve(key: AuthSessionAdapter.storageKey))
    }

    func testAuthKeychainPreservesExistingSDKBytesAndNamespace() throws {
        let service = "fatelab-compat-test-\(UUID().uuidString)"
        let old = KeychainLocalStorage(service: service)
        let fixed = AuthKeychainStorage(service: service)
        defer { try? fixed.remove(key: "session"); try? fixed.remove(key: "unrelated") }
        let bytes = Data("synthetic-existing-session".utf8)
        try old.store(key: "session", value: bytes)
        try old.store(key: "unrelated", value: Data("keep".utf8))
        XCTAssertEqual(try fixed.retrieve(key: "session"), bytes)
        let updated = Data("synthetic-updated-session".utf8)
        try fixed.store(key: "session", value: updated)
        XCTAssertEqual(try old.retrieve(key: "session"), updated)
        try fixed.remove(key: "session")
        try fixed.remove(key: "session")
        XCTAssertEqual(try old.retrieve(key: "unrelated"), Data("keep".utf8))
    }
    func testGooglePKCEPreparationExchangeAndCheckedStorage() async throws {
        let base = MemoryAuthStorage(), storage = AuthSessionStorage(base: base)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let client = SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false),
                           global: .init(session: URLSession(configuration: config))))
        let adapter = AuthSessionAdapter(storage: storage, client: client)
        let url = try client.auth.getOAuthSignInURL(provider: .google, redirectTo: URL(string: "fatelab://auth/callback")!)
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        XCTAssertEqual(query.first(where: { $0.name == "provider" })?.value, "google")
        XCTAssertNotNil(query.first(where: { $0.name == "code_challenge" })?.value)
        try storage.check()
        AuthURLProtocol.state.configure(response())
        let code = try AuthCallback.code(from: URL(string: "fatelab://auth/callback?code=synthetic-code")!)
        let session = try await client.auth.exchangeCodeForSession(authCode: code)
        XCTAssertEqual(try adapter.checked(session).user.id, session.user.id)
    }
    private func response(token: String = "synthetic-access", expires: Double = 4_000_000_000, userID: String = "11111111-1111-4111-8111-111111111111") -> Data {
        Data("""
        {"access_token":"\(token)","refresh_token":"synthetic-refresh","token_type":"bearer","expires_in":3600,"expires_at":\(expires),"user":{"id":"\(userID)","aud":"authenticated","role":"authenticated","email":"synthetic@example.invalid","app_metadata":{},"user_metadata":{},"created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","is_anonymous":false}}
        """.utf8)
    }
    private func setup(seed: Bool = true, expires: Double = 4_000_000_000, legacy: Data? = nil, removed: @escaping () throws -> Void = {}) throws -> (AuthStore, MemoryAuthStorage) {
        let base = MemoryAuthStorage(), storage = AuthSessionStorage(base: base)
        if seed {
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601; decoder.keyDecodingStrategy = .convertFromSnakeCase
            let value = try decoder.decode(Supabase.Session.self, from: response(expires: expires))
            try base.store(key: AuthSessionAdapter.storageKey, value: JSONEncoder().encode(value))
        }
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [AuthURLProtocol.self]
        let client = SupabaseClient(supabaseURL: URL(string: "https://synthetic.invalid")!, supabaseKey: "synthetic",
            options: .init(auth: .init(storage: storage, storageKey: AuthSessionAdapter.storageKey, flowType: .pkce, autoRefreshToken: false, emitLocalSessionAsInitialSession: true), global: .init(session: URLSession(configuration: config))))
        let store = AuthStore(adapter: AuthSessionAdapter(storage: storage, client: client), readLegacy: { legacy }, removeLegacy: removed)
        return (store, base)
    }
    func testPartnerRegistrationLostResponseRecoversWithNewClientWithoutNewPOST() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (503, "{}")])
        let first = APIClient(transport: streamTransport(), reportStore: storage)
        do {
            _ = try await first.createPartner(displayName: "合成", birthDate: "2000-01-01", birthTime: nil,
                birthplace: "東京都", gender: "female", relationshipType: "friend", relationshipLabel: "友人", auth: auth)
            XCTFail("lost response must remain unresolved")
        } catch {}
        let sent = try XCTUnwrap(StreamURLProtocol.requests.last)
        let operation = try XCTUnwrap(sent.value(forHTTPHeaderField: "Idempotency-Key"))
        XCTAssertEqual(sent.httpMethod, "POST")
        let partner = "{\"id\":\"22222222-2222-4222-8222-222222222222\",\"display_name\":\"合成\",\"birth_date\":\"2000-01-01\",\"birthplace\":\"東京都\",\"gender\":\"female\",\"relationship_type\":\"friend\"}"
        StreamURLProtocol.configure([(200, "{\"state\":\"completed\",\"partner\":\(partner)}")])
        let recovered = try await APIClient(transport: streamTransport(), reportStore: storage).recoverPartnerRegistration(auth: auth)
        XCTAssertEqual(recovered?.displayName, "合成")
        XCTAssertEqual(StreamURLProtocol.count, 1)
        XCTAssertEqual(StreamURLProtocol.requests.first?.httpMethod, "GET")
        XCTAssertTrue(StreamURLProtocol.requests.first?.url?.path.hasSuffix(operation) == true)
    }

    func testRegistrationRetryPreservesExactIDAndPayloadAndRejectsEdits() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        func create(_ api: APIClient, name: String = "合成") async throws -> PartnerProfile {
            try await api.createPartner(displayName: name, birthDate: "2000-01-01", birthTime: "12:34",
                birthplace: "東京都", gender: "female", relationshipType: "friend", relationshipLabel: "友人", auth: auth)
        }
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (503, "{}")])
        do { _ = try await create(APIClient(transport: streamTransport(), reportStore: storage)); XCTFail() } catch {}
        let first = try XCTUnwrap(StreamURLProtocol.requests.last)
        XCTAssertNotNil(first.httpBody)
        StreamURLProtocol.configure([])
        do { _ = try await create(APIClient(transport: streamTransport(), reportStore: storage), name: "変更"); XCTFail() } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (503, "{}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).recoverPartnerRegistration(auth: auth); XCTFail() } catch {}
        let resent = try XCTUnwrap(StreamURLProtocol.requests.last)
        XCTAssertEqual(StreamURLProtocol.count, 2)
        XCTAssertEqual(resent.httpMethod, "POST")
        XCTAssertEqual(resent.httpBody, first.httpBody)
        XCTAssertEqual(resent.value(forHTTPHeaderField: "Idempotency-Key"), first.value(forHTTPHeaderField: "Idempotency-Key"))
    }

    func testRegistrationTerminalStatesNeverResendAndUnknownRetainsOperation() async throws {
        for terminal in ["deleted", "cancelled"] {
            let (auth, _) = try setup(); await auth.restore()
            let storage = memoryReportStore()
            let client = APIClient(transport: streamTransport(), reportStore: storage)
            StreamURLProtocol.configure([(503, "{}")])
            do { _ = try await client.createPartner(displayName: "合成", birthDate: "2000-01-01", birthTime: nil,
                birthplace: "東京都", gender: "female", relationshipType: "friend", relationshipLabel: "友人", auth: auth); XCTFail() } catch {}
            let path = StreamURLProtocol.requests.first?.url?.path
            StreamURLProtocol.configure([(200, "{\"state\":\"unknown\"}")])
            do { _ = try await client.recoverPartnerRegistration(auth: auth); XCTFail() } catch {}
            XCTAssertEqual(StreamURLProtocol.count, 1)
            XCTAssertEqual(StreamURLProtocol.requests.first?.url?.path, path)
            StreamURLProtocol.configure([(200, "{\"state\":\"\(terminal)\"}")])
            do { _ = try await client.recoverPartnerRegistration(auth: auth); XCTFail() } catch {}
            XCTAssertEqual(StreamURLProtocol.count, 1)
            XCTAssertEqual(StreamURLProtocol.requests.first?.httpMethod, "GET")
            StreamURLProtocol.configure([])
            let result = try await client.recoverPartnerRegistration(auth: auth)
            XCTAssertNil(result); XCTAssertEqual(StreamURLProtocol.count, 0)
        }
    }

    func testRegistrationUnknownKeepsPayloadAndCancelUsesExistingOperation() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        let api = APIClient(transport: streamTransport(), reportStore: storage)
        StreamURLProtocol.configure([(200, "{\"state\":\"unexpected\"}")])
        do { _ = try await api.createPartner(displayName: "合成", birthDate: "2000-01-01", birthTime: nil,
            birthplace: "東京都", gender: "female", relationshipType: "friend", relationshipLabel: "友人", auth: auth); XCTFail() } catch {}
        let path = StreamURLProtocol.requests.first?.url?.path
        StreamURLProtocol.configure([(200, "{\"state\":\"cancelled\"}")])
        let result = try await api.recoverPartnerRegistration(auth: auth, cancel: true)
        XCTAssertNil(result)
        XCTAssertEqual(StreamURLProtocol.requests.first?.url?.path, (path ?? "") + "/cancel")
        XCTAssertEqual(StreamURLProtocol.requests.first?.httpMethod, "POST")
        StreamURLProtocol.configure([])
        let empty = try await api.recoverPartnerRegistration(auth: auth)
        XCTAssertNil(empty); XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    func testRegistrationStorageFailureStopsBeforeNetwork() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let broken = PendingReportStore(read: { _ in nil }, write: { _, _ in throw URLError(.cannotWriteToFile) }, remove: { _ in })
        StreamURLProtocol.configure([])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: broken).createPartner(displayName: "合成", birthDate: "2000-01-01", birthTime: nil,
            birthplace: "東京都", gender: "female", relationshipType: "friend", relationshipLabel: "友人", auth: auth); XCTFail() } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    func testAuthCheckBuildBlocksRealRequestConstructionAndSeparatesStorage() async throws {
        guard AppConfig.authenticationCheckOnly else { throw XCTSkip("AuthCheck configurationで別途実行する専用試験") }
        StreamURLProtocol.configure([])
        await APIClient(transport: streamTransport()).warmup()
        XCTAssertEqual(StreamURLProtocol.count, 0)
        XCTAssertTrue(AuthSessionAdapter.storageKey.hasPrefix("authcheck-"))
        XCTAssertTrue(AccountStorage.key("draft", userID: UUID()).hasPrefix("authcheck."))
        let purchases = PurchaseManager(storeKitEnabled: false)
        await purchases.load()
        XCTAssertNil(purchases.product)
        XCTAssertEqual(purchases.accessState, .unknown)
    }

    func testSDKRefreshSingleFlightAndOfflineRetention() async throws {
        let (store, _) = try setup()
        await store.restore()
        AuthURLProtocol.state.configure(response(token: "rotated"), delay: 0.1)
        async let first = store.validAccessToken(forceRefresh: true)
        async let second = store.validAccessToken(forceRefresh: true)
        let tokens = try await [first, second]
        XCTAssertEqual(tokens, ["rotated", "rotated"])
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
        AuthURLProtocol.state.configure(Data(), error: URLError(.notConnectedToInternet))
        do { _ = try await store.validAccessToken(forceRefresh: true); XCTFail("expected offline error") } catch {}
        XCTAssertNotNil(store.session)
        XCTAssertEqual(store.state, .temporarilyUnavailable)
    }
    func testLogoutDuringSDKRefreshDoesNotRestoreOldSession() async throws {
        let (store, base) = try setup()
        await store.restore()
        AuthURLProtocol.state.configure(response(token: "late"), delay: 0.1)
        let operation = Task { try await store.validAccessToken(forceRefresh: true) }
        try await Task.sleep(for: .milliseconds(20))
        store.signOut()
        _ = try? await operation.value
        XCTAssertNil(store.session)
        XCTAssertNil(try base.retrieve(key: AuthSessionAdapter.storageKey))
    }
    func testSDKStorageFailureDoesNotPublishLogin() async throws {
        let (store, base) = try setup(seed: false)
        await store.restore(); base.failWrites = true
        AuthURLProtocol.state.configure(response())
        await store.signIn(email: "synthetic@example.invalid", password: "synthetic-password")
        XCTAssertNil(store.session)
        XCTAssertNotNil(store.errorMessage)
    }
    func testLegacyMigratesOnlyAfterVerifiedSDKPersistence() async throws {
        let legacy = FateLab.Session(accessToken: "expired", refreshToken: "synthetic-refresh", expiresAt: 0,
            user: AppUser(id: UUID(uuidString: "11111111-1111-4111-8111-111111111111")!, email: nil))
        var removed = false
        AuthURLProtocol.state.configure(response())
        let (store, base) = try setup(seed: false, legacy: JSONEncoder().encode(legacy), removed: { removed = true })
        // Let the single automatic restore finish through the normal public operation gate.
        for _ in 0..<100 where store.state == .restoring { try await Task.sleep(for: .milliseconds(10)) }
        XCTAssertTrue(removed)
        XCTAssertNotNil(store.session)
        XCTAssertNotNil(try base.retrieve(key: AuthSessionAdapter.storageKey))
    }
    func testSignupNetworkFailureDoesNotClaimMailSent() async throws {
        let (store, _) = try setup(seed: false)
        await store.restore()
        AuthURLProtocol.state.configure(Data(), error: URLError(.notConnectedToInternet))
        await store.signUp(email: "synthetic@example.invalid", password: "synthetic-password")
        XCTAssertNil(store.noticeMessage)
        XCTAssertNotNil(store.errorMessage)
    }
    func testRevokedRefreshRequiresReauthenticationWithoutDeletingData() async throws {
        let (store, _) = try setup()
        await store.restore()
        AuthURLProtocol.state.configure(Data("{\"code\":\"refresh_token_not_found\",\"msg\":\"Refresh token not found\"}".utf8), status: 400)
        do { _ = try await store.validAccessToken(forceRefresh: true); XCTFail("expected invalid refresh") } catch {}
        XCTAssertEqual(store.state, .reauthenticationRequired)
        XCTAssertNotNil(store.session)
    }
    func testExpiredStoredSessionRequiresLoginAtLaunchWithoutRetryingApplicationAPI() async throws {
        AuthURLProtocol.state.configure(Data(#"{"code":"refresh_token_not_found","msg":"Refresh token not found"}"#.utf8), status: 400)
        let (auth, storage) = try setup(expires: 1)
        await auth.restore()
        XCTAssertEqual(auth.state, .reauthenticationRequired)
        XCTAssertNotNil(auth.session, "Retain the original account scope and its drafts")
        XCTAssertNil(try storage.retrieve(key: AuthSessionAdapter.storageKey), "The SDK removes the rejected credential")
        XCTAssertNil(auth.errorMessage)
        XCTAssertEqual(auth.noticeMessage, "ログインの有効期限が切れました。もう一度ログインしてください。")
        let callsAfterRestore = AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }
        XCTAssertEqual(callsAfterRestore, 1)
        do {
            _ = try await APIClient(transport: apiTransport()).status(auth: auth)
            XCTFail("A revoked session must not call the application API")
        } catch {}
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, callsAfterRestore)
    }

    func testExpiredStoredSessionShowsWelcomeBeforeLoginWithoutStartupError() async throws {
        guard !AppConfig.authenticationCheckOnly else { throw XCTSkip("通常版の起動画面の試験") }
        AuthURLProtocol.state.configure(Data(#"{"code":"refresh_token_not_found","msg":"Refresh token not found"}"#.utf8), status: 400)
        let (auth, _) = try setup(expires: 1); await auth.restore()
        let content = RootView(userID: auth.userID)
            .environmentObject(auth).environmentObject(PurchaseManager(storeKitEnabled: false))
            .environment(\.locale, Locale(identifier: "ja_JP")).preferredColorScheme(.light)
        let host = UIHostingController(rootView: content)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host; window.makeKeyAndVisible()
        defer { window.isHidden = true; AuthPresentation.shared.isPresented = false }
        try await Task.sleep(for: .milliseconds(1000))
        host.view.setNeedsLayout(); host.view.layoutIfNeeded()
        // Flush the first frame, then allow RootView's splash transition to finish.
        _ = UIGraphicsImageRenderer(size: host.view.bounds.size).image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
        try await Task.sleep(for: .milliseconds(500))
        host.view.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(size: host.view.bounds.size).image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
        let attachment = XCTAttachment(image: image)
        attachment.name = "expired-session-login"; attachment.lifetime = .keepAlways; add(attachment)
        // Verify the actual rendered RootView, including its non-dismissible login
        // gate. A state-only assertion missed this regression in build 70.
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate; request.recognitionLanguages = ["ja-JP", "en-US"]
        try VNImageRequestHandler(cgImage: XCTUnwrap(image.cgImage)).perform([request])
        let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        XCTAssertTrue(text.contains("はじめる"), text)
        XCTAssertTrue(text.contains("ログイン"), text)
        XCTAssertEqual(auth.state, .reauthenticationRequired)
        XCTAssertNotNil(auth.noticeMessage)
        XCTAssertFalse(text.contains("予期しないエラー"), text)
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1, "Only the rejected token refresh may run")
    }

    func testOfflineStartupRetainsAccountAndCanRefreshAfterConnectionRecovers() async throws {
        AuthURLProtocol.state.configure(Data(), error: URLError(.notConnectedToInternet))
        let (auth, storage) = try setup(expires: 1)
        await auth.restore()
        let originalUser = auth.userID
        XCTAssertEqual(auth.state, .temporarilyUnavailable)
        XCTAssertNotNil(originalUser)
        XCTAssertNotNil(try storage.retrieve(key: AuthSessionAdapter.storageKey))
        AuthURLProtocol.state.configure(response(token: "recovered-after-offline"))
        let token = try await auth.validAccessToken()
        XCTAssertEqual(token, "recovered-after-offline")
        XCTAssertEqual(auth.state, .authenticated)
        XCTAssertEqual(auth.userID, originalUser)
    }

    func testFailedMigrationKeepsLegacyForRecovery() async throws {
        let legacy = FateLab.Session(accessToken: "expired", refreshToken: "synthetic", expiresAt: 0,
            user: AppUser(id: UUID(), email: nil))
        var removed = false
        AuthURLProtocol.state.configure(Data(), error: URLError(.notConnectedToInternet))
        let (store, _) = try setup(seed: false, legacy: JSONEncoder().encode(legacy), removed: { removed = true })
        await store.restore()
        XCTAssertFalse(removed)
        XCTAssertEqual(store.state, .temporarilyUnavailable)
    }
    func testDuplicateCallbackNeverExchangesAndReplayExchangesOnce() async throws {
        let (store, base) = try setup(seed: false)
        await store.restore()
        try base.store(key: AuthSessionAdapter.storageKey + "-code-verifier", value: Data("synthetic-verifier".utf8))
        AuthURLProtocol.state.configure(response())
        await store.handleAuthCallback(URL(string: "fatelab://auth/callback?code=a&code=b")!)
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 0)
        let url = URL(string: "fatelab://auth/callback?code=synthetic")!
        await store.handleAuthCallback(url)
        await store.handleAuthCallback(url)
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
        XCTAssertNotNil(store.session)
    }

    func testLegacyEmailAccountWinsOverStaleSDKAccount() async throws {
        let userID = "22222222-2222-4222-8222-222222222222"
        let legacy = FateLab.Session(accessToken: "expired", refreshToken: "legacy-email", expiresAt: 0,
            user: AppUser(id: UUID(uuidString: userID)!, email: nil))
        AuthURLProtocol.state.configure(response(token: "email-B", userID: userID))
        let (store, _) = try setup(seed: true, legacy: JSONEncoder().encode(legacy))
        await store.restore()
        XCTAssertEqual(store.userID?.uuidString, userID.uppercased())
        XCTAssertEqual(store.session?.accessToken, "email-B")
    }

    func testMigrationAccountMismatchDoesNotLeaveRestoringOrPersistWrongAccount() async throws {
        let legacy = FateLab.Session(accessToken: "expired", refreshToken: "legacy-email", expiresAt: 0,
            user: AppUser(id: UUID(uuidString: "22222222-2222-4222-8222-222222222222")!, email: nil))
        var removed = false
        AuthURLProtocol.state.configure(response())
        let (store, base) = try setup(seed: false, legacy: JSONEncoder().encode(legacy), removed: { removed = true })
        await store.restore()
        XCTAssertEqual(store.state, .temporarilyUnavailable)
        XCTAssertNil(store.session)
        XCTAssertNotNil(store.errorMessage)
        XCTAssertFalse(removed)
        XCTAssertNil(try base.retrieve(key: AuthSessionAdapter.storageKey))
    }

    func testAccountScopeRejectsLogoutAndKeepsOwnerDraftsSeparate() async throws {
        let (store, _) = try setup()
        await store.restore()
        let owner = AccountScope(store)
        let a = owner.userID!
        let b = UUID()
        let suite = "fatelab-test-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set("A draft", forKey: AccountStorage.key("reading.draft", userID: a))
        defaults.set("B draft", forKey: AccountStorage.key("reading.draft", userID: b))
        store.signOut()
        XCTAssertThrowsError(try owner.check(store))
        XCTAssertEqual(defaults.string(forKey: AccountStorage.key("reading.draft", userID: a)), "A draft")
        XCTAssertEqual(defaults.string(forKey: AccountStorage.key("reading.draft", userID: b)), "B draft")
    }

    func testCompatibilityCompleteKeepsConversationIDWithoutDONE() async throws {
        let (store, _) = try setup(); await store.restore()
        let id = UUID()
        let report: [String: Any] = ["version":3, "reportText":"body", "cards":[["id":"test", "kind":"essence", "title":"title", "summary":"summary", "tags":[], "pages":[], "evidence":[]] as [String:Any]]]
        let json = String(decoding: try JSONSerialization.data(withJSONObject: ["type":"complete", "conversationId":id.uuidString, "report":report]), as: UTF8.self)
        StreamURLProtocol.configure([(200, "data: \(json)\n\n")])
        let result = try await APIClient(transport: streamTransport(), questionStore: memoryQuestionStore(), reportStore: memoryReportStore()).compatibility(partnerID: UUID(), conversationID: UUID(), relationshipType: "friend", relationshipLabel: "friend", auth: store)
        XCTAssertEqual(result.conversationID, id)
        XCTAssertEqual(result.reportText, "body")
    }

    func testCompatibilityInterruptedRequestRecoversByStatusWithoutChargingAgain() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore(), partner = UUID(), source = UUID(), saved = UUID()
        StreamURLProtocol.configure([(200, "")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).compatibility(partnerID: partner, conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("EOF accepted") }
        catch APIError.incompleteStream {}
        let pending = try XCTUnwrap(PendingCompatibilityStore(storage: storage).load(owner: auth.userID!))
        let report: [String: Any] = ["version":3, "reportText":"recovered", "cards":[["id":"test", "kind":"essence", "title":"title", "summary":"summary", "tags":[], "pages":[], "evidence":[]] as [String:Any]]]
        let json = String(decoding: try JSONSerialization.data(withJSONObject: ["state":"completed", "conversationId":saved.uuidString, "result":report]), as: UTF8.self)
        StreamURLProtocol.configure([(200, json)])
        let result = try await APIClient(transport: streamTransport(), reportStore: storage).compatibility(partnerID: partner, conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth)
        XCTAssertEqual(result.conversationID, saved)
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET"])
        XCTAssertTrue(StreamURLProtocol.requests[0].url!.path.hasSuffix(pending.operationID.uuidString))
        XCTAssertNil(try PendingCompatibilityStore(storage: storage).load(owner: auth.userID!))
    }

    func testCompatibilityPendingBlocksAndMissingResendsExactOperation() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore(), partner = UUID(), source = UUID()
        let client = APIClient(transport: streamTransport(), reportStore: storage)
        StreamURLProtocol.configure([(503, "{}")])
        do { _ = try await client.compatibility(partnerID: partner, conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("503 accepted") } catch {}
        let pending = try XCTUnwrap(PendingCompatibilityStore(storage: storage).load(owner: auth.userID!))
        StreamURLProtocol.configure([(200, "{\"state\":\"pending\"}")])
        do { _ = try await client.compatibility(partnerID: partner, conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("pending accepted") } catch {}
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET"])
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (503, "{}")])
        do { _ = try await client.compatibility(partnerID: partner, conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("503 accepted") } catch {}
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET", "POST"])
        XCTAssertEqual(StreamURLProtocol.requests.last?.httpBody, pending.payload)
        XCTAssertEqual(StreamURLProtocol.requests.last?.value(forHTTPHeaderField: "Idempotency-Key"), pending.operationID.uuidString)
        StreamURLProtocol.configure([])
        do { _ = try await client.compatibility(partnerID: UUID(), conversationID: source, relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("pending input replaced") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    func testCompatibilityConfirmedPreflightRejectionClearsOnlyItsRequest() async throws {
        let (auth, _) = try setup(); await auth.restore()
        for status in [400, 402, 404] {
            let storage = memoryReportStore()
            StreamURLProtocol.configure([(status, "{}")])
            do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).compatibility(partnerID: UUID(), conversationID: UUID(), relationshipType: "friend", relationshipLabel: "friend", auth: auth); XCTFail("rejection accepted") } catch {}
            XCTAssertNil(try PendingCompatibilityStore(storage: storage).load(owner: auth.userID!))
            XCTAssertEqual(StreamURLProtocol.count, 1)
        }
    }

    func testChatCreationResponseLossKeepsOperationThroughFirstQuestion() async throws {
        let (store, _) = try setup(); await store.restore()
        let pendingStore = memoryQuestionStore(), source = UUID(), child = UUID()
        StreamURLProtocol.configure([(503, "{\"code\":\"DEPENDENCY_NOT_READY\",\"error\":\"synthetic\"}")])
        do { _ = try await APIClient(transport: streamTransport(), questionStore: pendingStore).createChatConversation(sourceID: source, question: "first", auth: store); XCTFail("503 accepted") }
        catch APIError.dependencyNotReady {}
        let operationID = StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key")
        XCTAssertNotNil(operationID)
        let restarted = APIClient(transport: streamTransport(), questionStore: pendingStore)
        let restoredDraft = try await restarted.recoverQuestionDraft(conversationID: source, auth: store)
        XCTAssertEqual(restoredDraft, "first")
        StreamURLProtocol.configure([(201, "{\"id\":\"\(child.uuidString)\",\"reused\":true}")])
        let restoredChild = try await restarted.createChatConversation(sourceID: source, question: "first", auth: store)
        XCTAssertEqual(restoredChild, child)
        XCTAssertEqual(StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key"), operationID)
        XCTAssertEqual(try pendingStore.load(owner: store.userID!, conversation: child)?.sourceConversationID, source)
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (200, "data: {\"delta\":{\"text\":\"answer\"}}\n\ndata: {\"meta\":{}}\n\ndata: [DONE]\n\n")])
        _ = try await restarted.ask(conversationID: child, question: "first", auth: store)
        XCTAssertEqual(StreamURLProtocol.requests.last?.value(forHTTPHeaderField: "Idempotency-Key"), operationID)
        XCTAssertNil(try pendingStore.load(owner: store.userID!, conversation: child))
        var chatStore = pendingStore; chatStore.namespace = "chat.pending"
        XCTAssertNil(try chatStore.load(owner: store.userID!, conversation: source))
    }

    func testDeletedChatNeedsNewExplicitOperation() async throws {
        let (store, _) = try setup(); await store.restore()
        let pendingStore = memoryQuestionStore(), source = UUID()
        var creationStore = pendingStore; creationStore.namespace = "chat.pending"
        let old = PendingQuestion(operationID: UUID(), conversationID: source, question: "question")
        try creationStore.save(old, owner: store.userID!)
        let client = APIClient(transport: streamTransport(), questionStore: pendingStore)
        StreamURLProtocol.configure([(410, "{\"code\":\"CHAT_DELETED\",\"error\":\"deleted\"}")])
        do { _ = try await client.createChatConversation(sourceID: source, question: "question", auth: store); XCTFail("deleted chat accepted") }
        catch APIError.http(status: 410, message: _) {}
        XCTAssertEqual(StreamURLProtocol.count, 1)
        XCTAssertNil(try creationStore.load(owner: store.userID!, conversation: source))
        StreamURLProtocol.configure([(201, "{\"id\":\"\(UUID().uuidString)\"}")])
        _ = try await client.createChatConversation(sourceID: source, question: "question", auth: store)
        XCTAssertNotEqual(StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key"), old.operationID.uuidString)
    }

    func testUnknownChatCreationCannotChangePayloadOrOwner() async throws {
        let (store, _) = try setup(); await store.restore()
        var pendingStore = memoryQuestionStore(); pendingStore.namespace = "chat.pending"
        let source = UUID()
        try pendingStore.save(.init(operationID: UUID(), conversationID: source, question: "original"), owner: store.userID!)
        var storage = pendingStore; storage.namespace = "question.pending"
        StreamURLProtocol.configure([])
        do { _ = try await APIClient(transport: streamTransport(), questionStore: storage).createChatConversation(sourceID: source, question: "changed", auth: store); XCTFail("changed payload accepted") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
        XCTAssertNil(try pendingStore.load(owner: UUID(), conversation: source))
    }

    private func memoryReportStore() -> PendingReportStore {
        let memory = MemoryAuthStorage()
        return .init(read: { try memory.retrieve(key: $0) }, write: { try memory.store(key: $1, value: $0) }, remove: { try memory.remove(key: $0) })
    }

    func testGenerationShowsConnectionStagesBeforeRequestsAndOnlyThenStreamPercentage() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        let report: [String: Any] = ["version":3, "reportText":"body", "generatorVersion":"synthetic", "cards":[["id":"test", "kind":"essence", "title":"title", "summary":"summary", "tags":[], "pages":[], "evidence":[]] as [String:Any]]]
        let json = String(decoding: try JSONSerialization.data(withJSONObject: ["type":"complete", "report":report]), as: UTF8.self)
        let serverProgress = GenerationProgress(percent: 18, title: "命式を計算しています", detail: "基本データ")
        StreamURLProtocol.configure([(200, "{}"), (200, "data: {\"type\":\"progress\",\"percent\":18,\"title\":\"命式を計算しています\",\"detail\":\"基本データ\"}\n\ndata: \(json)\n\ndata: [DONE]\n\n")])
        var values: [GenerationProgress] = [], requestCounts: [Int] = []
        _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: BirthInput(), auth: auth) {
            values.append($0); requestCounts.append(StreamURLProtocol.count)
        }
        XCTAssertEqual(values, [.preparing, .requesting, serverProgress])
        XCTAssertEqual(requestCounts, [0, 1, 2])
        XCTAssertTrue(values[0].isIndeterminate)
        XCTAssertTrue(values[1].isIndeterminate)
        XCTAssertFalse(values[2].isIndeterminate)
        XCTAssertNotNil(try storage.load(owner: auth.userID!))
        XCTAssertNil(try PendingGenerationStore(storage: storage).load(owner: auth.userID!))
    }

    func testCalculationFailureDoesNotAdvanceProgressOrSubmitGeneration() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        StreamURLProtocol.configure([(400, "{\"error\":\"invalid input\"}")])
        var values: [GenerationProgress] = []
        do {
            _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: BirthInput(), auth: auth) { values.append($0) }
            XCTFail("calculation failure accepted")
        } catch APIError.http(let status, _) { XCTAssertEqual(status, 400) }
        XCTAssertEqual(values, [.preparing])
        XCTAssertEqual(StreamURLProtocol.count, 1)
        XCTAssertNil(try PendingGenerationStore(storage: storage).load(owner: auth.userID!))
        XCTAssertNil(try storage.load(owner: auth.userID!))
    }

    func testCompleteReportIsDurableBeforeTrailingStreamEnds() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore(), input = BirthInput()
        let report: [String: Any] = ["version":3, "reportText":"body", "generatorVersion":"synthetic", "cards":[["id":"test", "kind":"essence", "title":"title", "summary":"summary", "tags":[], "pages":[], "evidence":[]] as [String:Any]]]
        let json = String(decoding: try JSONSerialization.data(withJSONObject: ["type":"complete", "report":report]), as: UTF8.self)
        StreamURLProtocol.configure([(200, "{}"), (200, "data: \(json)\n\ndata: interrupted")])
        let client = APIClient(transport: streamTransport(), reportStore: storage)
        do { _ = try await client.generateReport(input: input, auth: auth); XCTFail("partial trailing frame accepted") }
        catch APIError.incompleteStream {}
        let snapshot = try XCTUnwrap(storage.load(owner: auth.userID!))
        StreamURLProtocol.configure([])
        let restored = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth)
        XCTAssertEqual(restored.saveOperationID, snapshot.operationID)
        XCTAssertEqual(restored.text, "body")
        XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    func testGenerationInterruptedBeforeCompleteRecoversByStatusAcrossRestart() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore(), input = BirthInput()
        StreamURLProtocol.configure([(200, "{}"), (200, "")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth); XCTFail("EOF accepted") }
        catch APIError.incompleteStream {}
        let pending = try XCTUnwrap(PendingGenerationStore(storage: storage).load(owner: auth.userID!))
        let report: [String: Any] = ["version":3, "reportText":"recovered", "generatorVersion":"synthetic", "cards":[["id":"test", "kind":"essence", "title":"title", "summary":"summary", "tags":[], "pages":[], "evidence":[]] as [String:Any]]]
        let response = String(decoding: try JSONSerialization.data(withJSONObject: ["state":"completed", "result":report]), as: UTF8.self)
        StreamURLProtocol.configure([(200, response)])
        let restored = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth)
        XCTAssertEqual(restored.saveOperationID, pending.operationID)
        XCTAssertEqual(restored.text, "recovered")
        XCTAssertEqual(StreamURLProtocol.count, 1)
        XCTAssertEqual(StreamURLProtocol.requests[0].httpMethod, "GET")
        XCTAssertTrue(StreamURLProtocol.requests[0].url!.path.hasSuffix(pending.operationID.uuidString))
        XCTAssertNil(try PendingGenerationStore(storage: storage).load(owner: auth.userID!))
        XCTAssertNotNil(try storage.load(owner: auth.userID!))
    }

    func testGenerationPendingDoesNotResubmitAndMissingReusesExactPayload() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore(), input = BirthInput()
        StreamURLProtocol.configure([(200, "{}"), (503, "{}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth); XCTFail("503 accepted") } catch {}
        let pending = try XCTUnwrap(PendingGenerationStore(storage: storage).load(owner: auth.userID!))
        StreamURLProtocol.configure([(200, "{\"state\":\"pending\"}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth); XCTFail("pending accepted") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 1)
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (503, "{}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).generateReport(input: input, auth: auth); XCTFail("503 accepted") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 2)
        XCTAssertEqual(StreamURLProtocol.requests[1].httpBody, pending.payload)
        XCTAssertEqual(StreamURLProtocol.requests[1].value(forHTTPHeaderField: "Idempotency-Key"), pending.operationID.uuidString)
        XCTAssertEqual(try PendingGenerationStore(storage: storage).load(owner: auth.userID!)?.operationID, pending.operationID)
    }

    func testPendingReportReturnsWithoutStartingGeneration() async throws {
        let (auth, _) = try setup(); await auth.restore()
        var input = BirthInput()
        input.date = Calendar(identifier: .gregorian).date(from: DateComponents(year: 2000, month: 1, day: 1))!
        input.birthTime = nil
        let birth: [String: Any] = ["birthDate":"2000-01-01", "birthTime":"", "nickname":input.nickname, "birthplace":input.birthplace, "gender":input.gender]
        let original = GeneratedReport(birthData: birth, calculatedData: [:], text: "saved body")
        let storage = memoryReportStore()
        try storage.save(PendingReport(original), owner: auth.userID!)
        StreamURLProtocol.configure([])
        let client = APIClient(transport: streamTransport(), reportStore: storage)
        let restored = try await client.generateReport(input: input, auth: auth)
        XCTAssertEqual(restored.saveOperationID, original.saveOperationID)
        XCTAssertEqual(restored.text, "saved body")
        input.nickname = "different"
        do { _ = try await client.generateReport(input: input, auth: auth); XCTFail("pending report overwritten") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    func testDeletedReportClearsOnlyItsPendingSaveWithoutRegeneration() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        let report = GeneratedReport(birthData: [:], calculatedData: [:], text: "body")
        StreamURLProtocol.configure([(410, "{\"code\":\"READING_DELETED\",\"error\":\"deleted\"}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).createConversation(report: report, auth: auth); XCTFail("deleted accepted") }
        catch APIError.http(status: 410, message: _) {}
        XCTAssertEqual(StreamURLProtocol.count, 1)
        XCTAssertNil(try storage.load(owner: auth.userID!))
    }

    func testReportSaveResponseLossReplaysExactPayloadAcrossRestart() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let storage = memoryReportStore()
        let report = GeneratedReport(birthData: [:], calculatedData: ["number": 1.25], text: "body", structuredSnapshot: ["version":3,"cards":[],"reportText":"body","generatorVersion":"synthetic"])
        StreamURLProtocol.configure([(503, "{\"code\":\"DEPENDENCY_NOT_READY\"}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).createConversation(report: report, auth: auth); XCTFail("503 accepted") }
        catch APIError.dependencyNotReady {}
        let first = try XCTUnwrap(StreamURLProtocol.requests.first)
        let restarted = APIClient(transport: streamTransport(), reportStore: storage)
        let restored = try XCTUnwrap(restarted.pendingReport(auth: auth))
        let conversationID = UUID()
        StreamURLProtocol.configure([(200, "{\"id\":\"\(conversationID.uuidString)\",\"revisionId\":\"\(UUID().uuidString)\",\"reused\":true}")])
        let saved = try await restarted.createConversation(report: restored, auth: auth)
        XCTAssertEqual(saved, conversationID)
        XCTAssertEqual(StreamURLProtocol.requests.first?.httpBody, first.httpBody)
        XCTAssertEqual(StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key"), first.value(forHTTPHeaderField: "Idempotency-Key"))
        XCTAssertNil(try storage.load(owner: auth.userID!))
    }

    func testReportSaveRequiresDurabilityAndRevisionAcknowledgement() async throws {
        let (auth, _) = try setup(); await auth.restore()
        let report = GeneratedReport(birthData: [:], calculatedData: [:], text: "body")
        let broken = PendingReportStore(read: { _ in nil }, write: { _, _ in throw URLError(.cannotWriteToFile) }, remove: { _ in })
        StreamURLProtocol.configure([])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: broken).createConversation(report: report, auth: auth); XCTFail("storage failure ignored") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
        let storage = memoryReportStore()
        StreamURLProtocol.configure([(200, "{\"id\":\"\(UUID().uuidString)\"}")])
        do { _ = try await APIClient(transport: streamTransport(), reportStore: storage).createConversation(report: report, auth: auth); XCTFail("missing revision accepted") } catch APIError.invalidResponse {}
        XCTAssertEqual(try storage.load(owner: auth.userID!)?.operationID, report.saveOperationID)
    }

    private func memoryQuestionStore() -> PendingQuestionStore {
        let storage = MemoryAuthStorage()
        return PendingQuestionStore(read: { try storage.retrieve(key: $0) }, write: { try storage.store(key: $1, value: $0) }, remove: { try storage.remove(key: $0) })
    }

    func testSavedAnswerRecoveredAfterLostDONEAcrossClientRestart() async throws {
        let (store, _) = try setup(); await store.restore()
        let pendingStore = memoryQuestionStore(), conversation = UUID()
        StreamURLProtocol.configure([(200, "data: {\"delta\":{\"text\":\"回答\"}}\n\ndata: {\"meta\":{\"suggestions\":[]}}\n\n")])
        do { _ = try await APIClient(transport: streamTransport(), questionStore: pendingStore).ask(conversationID: conversation, question: "test", auth: store); XCTFail("missing DONE") }
        catch APIError.incompleteStream {}
        let pending = try XCTUnwrap(pendingStore.load(owner: store.userID!, conversation: conversation))
        XCTAssertEqual(StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key"), pending.operationID.uuidString)
        StreamURLProtocol.configure([(200, "{\"state\":\"completed\",\"result\":{\"answer\":\"保存済み回答\",\"suggestions\":[]}}")])
        let restored = try await APIClient(transport: streamTransport(), questionStore: pendingStore).ask(conversationID: conversation, question: "test", auth: store)
        XCTAssertEqual(restored.text, "保存済み回答")
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET"])
        XCTAssertNil(try pendingStore.load(owner: store.userID!, conversation: conversation))
    }

    func testUnknownSendRetriesSameIDOnlyAfterNotFoundStatus() async throws {
        let (store, _) = try setup(); await store.restore()
        let pendingStore = memoryQuestionStore(), conversation = UUID()
        let client = APIClient(transport: streamTransport(), questionStore: pendingStore)
        StreamURLProtocol.configure([(503, "{}")])
        do { _ = try await client.ask(conversationID: conversation, question: "test", auth: store); XCTFail("503 accepted") }
        catch APIError.dependencyNotReady {}
        let firstID = StreamURLProtocol.requests.first?.value(forHTTPHeaderField: "Idempotency-Key")
        StreamURLProtocol.configure([(200, "{\"state\":\"not_found\"}"), (200, "data: {\"delta\":{\"text\":\"answer\"}}\n\ndata: {\"meta\":{}}\n\ndata: [DONE]\n\n")])
        _ = try await client.ask(conversationID: conversation, question: "test", auth: store)
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET", "POST"])
        XCTAssertEqual(StreamURLProtocol.requests.last?.value(forHTTPHeaderField: "Idempotency-Key"), firstID)
    }

    func testPendingAndStorageFailureNeverSendAnotherQuestion() async throws {
        let (store, _) = try setup(); await store.restore()
        let pendingStore = memoryQuestionStore(), conversation = UUID()
        try pendingStore.save(.init(operationID: UUID(), conversationID: conversation, question: "old"), owner: store.userID!)
        StreamURLProtocol.configure([(200, "{\"state\":\"pending\"}")])
        do { _ = try await APIClient(transport: streamTransport(), questionStore: pendingStore).ask(conversationID: conversation, question: "new", auth: store); XCTFail("overlapping question") } catch {}
        XCTAssertEqual(StreamURLProtocol.requests.map(\.httpMethod), ["GET"])
        XCTAssertNil(try pendingStore.load(owner: UUID(), conversation: conversation))
        let broken = PendingQuestionStore(read: { _ in nil }, write: { _, _ in throw URLError(.cannotWriteToFile) }, remove: { _ in })
        StreamURLProtocol.configure([])
        do { _ = try await APIClient(transport: streamTransport(), questionStore: broken).ask(conversationID: conversation, question: "test", auth: store); XCTFail("storage failure ignored") } catch {}
        XCTAssertEqual(StreamURLProtocol.count, 0)
    }

    private func streamTransport() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StreamURLProtocol.self]
        return URLSession(configuration: config)
    }
    func testQuestionEOFNeverEmitsDoneAndDoesNotRetry() async throws {
        let (store, _) = try setup(); await store.restore()
        StreamURLProtocol.configure([(200, "data: {\"delta\":{\"text\":\"途中\"}}\n\n")])
        var done = false, text = ""
        do {
            for try await event in APIClient(transport: streamTransport(), questionStore: memoryQuestionStore()).askStream(conversationID: UUID(), question: "test", auth: store) {
                if case .done = event { done = true }
                if case .delta(let value) = event { text += value }
            }
            XCTFail("EOF accepted")
        } catch APIError.incompleteStream {} catch { XCTFail("unexpected \(error)") }
        XCTAssertFalse(done); XCTAssertEqual(text, "途中")
        XCTAssertEqual(StreamURLProtocol.count, 1)
    }
    func testQuestion401RefreshesOnceThenCompletes() async throws {
        let (store, _) = try setup(); await store.restore()
        AuthURLProtocol.state.configure(response(token: "rotated"))
        StreamURLProtocol.configure([(401, "{}"), (200, "data: {\"delta\":{\"text\":\"回答\"}}\n\ndata: {\"meta\":{\"suggestions\":[]}}\n\ndata: [DONE]\n\n")])
        let answer = try await APIClient(transport: streamTransport(), questionStore: memoryQuestionStore()).ask(conversationID: UUID(), question: "test", auth: store)
        XCTAssertEqual(answer.text, "回答")
        XCTAssertEqual(StreamURLProtocol.count, 2)
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
    }
    func testGenerationHTTP402429And503AreTypedWithoutRetry() async throws {
        let (store, _) = try setup(); await store.restore()
        for status in [402, 429, 503] {
            StreamURLProtocol.configure([(status, "{\"error\":\"synthetic\"}")])
            do {
                _ = try await APIClient(transport: streamTransport(), questionStore: memoryQuestionStore(), reportStore: memoryReportStore()).compatibility(partnerID: UUID(), conversationID: UUID(), relationshipType: "friend", relationshipLabel: "friend", auth: store)
                XCTFail("HTTP error accepted")
            } catch APIError.paymentRequired { XCTAssertEqual(status, 402) }
              catch APIError.rateLimited { XCTAssertEqual(status, 429) }
              catch APIError.dependencyNotReady { XCTAssertEqual(status, 503) }
              catch { XCTFail("unexpected \(error)") }
            XCTAssertEqual(StreamURLProtocol.count, 1)
        }
    }

    func testAccountDeletion204ClearsSessionAndStoredToken() async throws {
        let (auth, storage) = try setup(); await auth.restore()
        let before = AccountScope(auth)
        StreamURLProtocol.configure([(204, "")])
        let deleted = await auth.deleteAccount(api: APIClient(transport: streamTransport()))
        XCTAssertTrue(deleted)
        XCTAssertNil(auth.session)
        XCTAssertEqual(auth.state, .signedOut)
        XCTAssertFalse(auth.isWorking)
        XCTAssertFalse(auth.isDeletingAccount)
        XCTAssertFalse(before.isCurrent(auth))
        XCTAssertNil(try storage.retrieve(key: AuthSessionAdapter.storageKey))
        XCTAssertEqual(StreamURLProtocol.requests.map { $0.httpMethod }, ["DELETE"])
        XCTAssertEqual(StreamURLProtocol.requests.first?.url?.path, "/api/reading/account")
    }

    func testAccountDeletionFailureRemainsSignedInAndExposesError() async throws {
        let (auth, storage) = try setup(); await auth.restore()
        let before = AccountScope(auth)
        StreamURLProtocol.configure([(500, "{\"error\":\"アカウントを削除できませんでした\"}")])
        let deleted = await auth.deleteAccount(api: APIClient(transport: streamTransport()))
        XCTAssertFalse(deleted)
        XCTAssertTrue(before.isCurrent(auth))
        XCTAssertNotNil(auth.session)
        XCTAssertNotNil(try storage.retrieve(key: AuthSessionAdapter.storageKey))
        XCTAssertNotNil(auth.errorMessage)
        XCTAssertFalse(auth.isDeletingAccount)
        XCTAssertFalse(auth.isWorking)
        XCTAssertEqual(StreamURLProtocol.count, 1, "Do not automatically resend an uncertain destructive request")
    }

    func testLostDeletionResponseCanBeRetriedToClearLocalSession() async throws {
        let (auth, _) = try setup(); await auth.restore()
        AuthURLProtocol.state.configure(Data(), error: URLError(.networkConnectionLost))
        let first = await auth.deleteAccount(api: APIClient(transport: apiTransport()))
        XCTAssertFalse(first)
        XCTAssertNotNil(auth.session)
        XCTAssertNotNil(auth.errorMessage)
        StreamURLProtocol.configure([(204, "")])
        let retry = await auth.deleteAccount(api: APIClient(transport: streamTransport()))
        XCTAssertTrue(retry)
        XCTAssertNil(auth.session)
        XCTAssertNil(auth.errorMessage)
    }

    func testAccountDeletionPreventsDoubleSubmissionWhilePending() async throws {
        let (auth, _) = try setup(); await auth.restore()
        AuthURLProtocol.state.configure(Data(), status: 204, delay: 0.2)
        let api = APIClient(transport: apiTransport())
        let operation = Task { await auth.deleteAccount(api: api) }
        try await Task.sleep(for: .milliseconds(30))
        XCTAssertTrue(auth.isDeletingAccount)
        let repeated = await auth.deleteAccount(api: api)
        XCTAssertFalse(repeated)
        let deleted = await operation.value
        XCTAssertTrue(deleted)
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
    }

    func testAccountDeletionResponseCannotAffectNewAccountScope() async throws {
        let (auth, _) = try setup(); await auth.restore()
        AuthURLProtocol.state.configure(Data(), status: 204, delay: 0.2)
        let operation = Task { await auth.deleteAccount(api: APIClient(transport: apiTransport())) }
        try await Task.sleep(for: .milliseconds(30))
        auth.signOut()
        let newScope = AccountScope(auth)
        auth.errorMessage = "new scope message"
        let deleted = await operation.value
        XCTAssertFalse(deleted)
        XCTAssertTrue(newScope.isCurrent(auth))
        XCTAssertEqual(auth.errorMessage, "new scope message")
        XCTAssertFalse(auth.isDeletingAccount)
    }

    private func apiTransport() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [AuthURLProtocol.self]
        return URLSession(configuration: config)
    }

    func testOldStatusResponseCannotBeDeliveredAfterLogout() async throws {
        let (store, _) = try setup()
        await store.restore()
        AuthURLProtocol.state.configure(Data("{}".utf8), delay: 0.1)
        let client = APIClient(transport: apiTransport(), reportStore: memoryReportStore())
        let operation = Task { try await client.status(auth: store) }
        try await Task.sleep(for: .milliseconds(20))
        store.signOut()
        do { _ = try await operation.value; XCTFail("old owner response") }
        catch { XCTAssertTrue(error is CancellationError) }
    }

    func testLogoutDuringCalculationPreventsPreviewAndAutomaticSave() async throws {
        let (store, _) = try setup()
        await store.restore()
        AuthURLProtocol.state.configure(Data("{}".utf8), delay: 0.1)
        let client = APIClient(transport: apiTransport(), reportStore: memoryReportStore())
        let operation = Task {
            let report = try await client.generateReport(input: BirthInput(), auth: store)
            return try await client.createConversation(report: report, auth: store)
        }
        try await Task.sleep(for: .milliseconds(20))
        store.signOut()
        do { _ = try await operation.value; XCTFail("old generation saved") }
        catch { XCTAssertTrue(error is CancellationError) }
        // Includes only the calculation request; no preview or save request.
        XCTAssertEqual(AuthURLProtocol.state.lock.withLock { AuthURLProtocol.state.calls }, 1)
    }

}

final class StreamURLProtocol: URLProtocol, @unchecked Sendable {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var replies: [(Int, String)] = []
    nonisolated(unsafe) private static var calls = 0
    nonisolated(unsafe) private static var recorded: [URLRequest] = []
    static var requests: [URLRequest] { lock.withLock { recorded } }
    static var count: Int { lock.withLock { calls } }
    static func configure(_ values: [(Int, String)]) { lock.withLock { replies = values; calls = 0; recorded = [] } }
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var captured = request
        if captured.httpBody == nil, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var body = Data(), buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                body.append(contentsOf: buffer.prefix(count))
            }
            captured.httpBody = body
        }
        let reply = Self.lock.withLock {
            Self.calls += 1
            Self.recorded.append(captured)
            return Self.replies.isEmpty ? (500, "unexpected retry") : Self.replies.removeFirst()
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: reply.0, httpVersion: nil, headerFields: ["Content-Type": "text/event-stream"])!, cacheStoragePolicy: .notAllowed)
        // Deliver one byte at a time to exercise actual URLSession decoding.
        for byte in reply.1.utf8 { client?.urlProtocol(self, didLoad: Data([byte])) }
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor
final class SettingsRegressionTests: XCTestCase {
    func testInitialTabIsSelectedOncePerAccountView() {
        let router = AppTabRouter()
        router.selectTab(.settings)
        router.selectInitialTabIfNeeded()
        XCTAssertEqual(router.selectedTab, .you)
        router.selectTab(.settings)
        router.selectInitialTabIfNeeded()
        XCTAssertEqual(router.selectedTab, .settings, "Returning from a sheet must preserve the selected tab")
    }

    func testTabStartsAtYouAndCanReturnFromSettings() async throws {
        let router = AppTabRouter()
        let content = TabView(selection: Binding(get: { router.selectedTab }, set: { router.selectTab($0) })) {
            ResettableTabStack(tab: .you) { Text("YOU_CONTENT") }.tabItem { Text("あなた") }.tag(AppTab.you)
            ResettableTabStack(tab: .couple) { Text("COUPLE_CONTENT") }.tabItem { Text("ふたり") }.tag(AppTab.couple)
            ResettableTabStack(tab: .readings) { Text("READINGS_CONTENT") }.tabItem { Text("鑑定書") }.tag(AppTab.readings)
            ResettableTabStack(tab: .chat) { Text("CHAT_CONTENT") }.tabItem { Text("対話") }.tag(AppTab.chat)
            ResettableTabStack(tab: .settings) { Text("SETTINGS_CONTENT") }.tabItem { Text("設定") }.tag(AppTab.settings)
        }.environmentObject(router)
        let host = UIHostingController(rootView: content)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = host; window.makeKeyAndVisible()
        defer { window.isHidden = true }
        try await Task.sleep(for: .milliseconds(800))
        func descendants(_ vc: UIViewController) -> [UIViewController] { vc.children.flatMap { [$0] + descendants($0) } }
        host.view.setNeedsLayout(); host.view.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(size: host.view.bounds.size).image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
        let attachment = XCTAttachment(image: image); attachment.name = "initial-you-tab"; attachment.lifetime = .keepAlways; add(attachment)
        try await Task.sleep(for: .milliseconds(500))
        let tabs = try XCTUnwrap(descendants(host).compactMap { $0 as? UITabBarController }.first)
        print("ROOT_TAB_PROBE initial", tabs.selectedIndex, "router", router.selectedTab.rawValue, "count", tabs.viewControllers?.count ?? 0)
        XCTAssertEqual(tabs.viewControllers?.count, 5)
        XCTAssertEqual(tabs.selectedIndex, 0, "A fresh app must display あなた")
        XCTAssertEqual(router.selectedTab, .you)
        router.selectTab(.settings)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertEqual(tabs.selectedIndex, 4)
        router.selectTab(.you)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertEqual(tabs.selectedIndex, 0)
        router.selectTab(.you)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertEqual(tabs.selectedIndex, 0)
    }
}

final class FeedbackPresentationTests: XCTestCase {
    @MainActor
    func testUnrequestedAppleFailureDoesNotPolluteLoginScreen() async {
        let auth = AuthStore()
        await auth.restore()
        let before = auth.errorMessage
        await auth.completeAppleSignIn(.failure(NSError(domain: "unrequested", code: 1)))
        XCTAssertEqual(auth.errorMessage, before)
        XCTAssertFalse(auth.isWorking)
    }

    func testAllYearHistoryUsesCurrentCardsAndKeepsSavedFutureYears() {
        func year(_ year: Int, _ text: String, scope: String = "self") -> ReadingCard {
            ReadingCard(id: "turning-year-\(year)", kind: "timing", tab: "timing", scope: scope, title: text, summary: text,
                tags: [], period: ReadingCardPeriod(label: "\(year)年"), pages: [], sections: nil, evidence: [])
        }
        let merged = SelfTimingHistory.merging([year(2022, "追加された年"), year(2023, "再計算"), year(2020, "相手", scope: "couple")], saved: [year(2023, "保存本文"), year(2027, "将来の節目")])
        XCTAssertEqual(merged.compactMap(\.calendarYear), [2022, 2023, 2027])
        XCTAssertEqual(merged.map(\.title), ["追加された年", "再計算", "将来の節目"])
    }

    func testAnnualRelationshipExcerptKeepsBothEncountersAndReview() {
        let body = "新しい人との出会いが増える時期です。見えていなかった食い違いが表に出て、関係の前提を確かめ直す時期です。"
        let section = ReadingCardSection(heading: "人との関係", body: body, evidence: [], termGloss: [], claimId: "timing-annual-2031-relationships")
        let card = ReadingCard(id: "turning-year-2031", kind: "timing", tab: "timing", scope: "self", title: "年のテーマ", summary: "役割を見直す時期です。" + body,
            tags: [], period: nil, pages: [], sections: [section], evidence: [])
        XCTAssertEqual(card.domainSummaries.first?.text, body)
        XCTAssertTrue(card.domainSummaries.first?.text.contains("食い違い") == true)
        XCTAssertFalse(card.domainSummaries.first?.text.contains("裏切り") == true)
    }

    func testReadingOwnerNameComesFromSelfBirthInputOnly() throws {
        let id = UUID().uuidString
        func decode(_ kind: String, _ birth: String) throws -> ReadingSummary {
            try JSONDecoder().decode(ReadingSummary.self, from: Data("{\"id\":\"\(id)\",\"title\":\"鑑定書\",\"kind\":\"\(kind)\",\"birth_data\":\(birth)}".utf8))
        }
        XCTAssertEqual(try decode("self", #"{"nickname":" 愛美 "}"#).ownerDisplayName, "愛美")
        XCTAssertNil(try decode("compatibility", #"{"nickname":"相手"}"#).ownerDisplayName)
        XCTAssertNil(try decode("chat", #"{"nickname":"対話"}"#).ownerDisplayName)
        XCTAssertNil(try decode("self", "null").ownerDisplayName)
    }

    func testPartnerNameFallbackIsAccountScoped() throws {
        let name = "fatelab-profile-test-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        let owner = UUID(), other = UUID()
        var input = BirthInput(); input.nickname = "愛美"
        defaults.set(try JSONEncoder().encode(input).base64EncodedString(), forKey: AccountStorage.key("onboarding.draft", userID: owner))
        XCTAssertEqual(AccountStorage.birthProfile(userID: owner, defaults: defaults)?.nickname, "愛美")
        XCTAssertNil(AccountStorage.birthProfile(userID: other, defaults: defaults))
        XCTAssertNil(AccountStorage.birthProfile(userID: nil, defaults: defaults))
    }

    func testTimingDomainExcerptsNeverInferAnEventFromTags() {
        func card(_ text: String, scope: String = "self") -> ReadingCard {
            ReadingCard(id: "year", kind: "timing", tab: "timing", scope: scope, title: "年のテーマ", summary: text,
                        tags: ["恋愛", "仕事"], period: ReadingCardPeriod(label: "これから 2026年"), pages: [], sections: nil, evidence: [])
        }
        let value = card("交際を始めることがテーマです。仕事では役割を見直すことがテーマです。")
        XCTAssertEqual(value.domainSummaries.map(\.label), ["恋愛・結婚", "仕事"])
        XCTAssertTrue(value.domainSummaries.allSatisfy { value.summary.contains($0.text) })
        XCTAssertTrue(card("静かに考えることがテーマです。").domainSummaries.isEmpty)
        XCTAssertTrue(card(value.summary, scope: "couple").domainSummaries.isEmpty)
        XCTAssertEqual(value.calendarYear, 2026)
    }
}
