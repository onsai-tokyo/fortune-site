import Foundation
import CryptoKit
import OSLog

struct GenerationProgress: Hashable {
    let percent: Int; let title: String; let detail: String
    // Progress percentages come from the generation stream. Connection/setup has no measured percentage.
    var isIndeterminate: Bool { percent == 0 }
    static let preparing = GenerationProgress(percent: 0, title: "鑑定の準備をしています", detail: "サーバーに接続し、生年月日と出生地から基本データを計算します。")
    static let requesting = GenerationProgress(percent: 0, title: "鑑定の開始を待っています", detail: "基本データを受け取りました。鑑定を開始する応答を待っています。")
    static let recovering = GenerationProgress(percent: 0, title: "前の鑑定を確認しています", detail: "同じ鑑定の処理状況を確認しています。")
}
enum GenerationKind { case selfReading, compatibility }

enum APIError: LocalizedError {
    case invalidResponse
    case incompleteStream
    case timeout
    case http(status: Int, message: String)
    case authSessionInvalid(String)
    case selfReadingRequired(String)
    case dependencyNotReady(String)
    case generationTimeout(String)
    case paymentRequired(String)
    case rateLimited(String)
    case server(String)
    var errorDescription: String? {
        switch self {
        case .incompleteStream: "通信が途中で終了しました。履歴を確認してから再試行してください"
        case .invalidResponse: "読み込めませんでした。通信環境を確認して、もう一度お試しください"
        case .timeout: "応答に時間がかかっています。もう一度お試しください"
        case .http(_, let message): message
        case .authSessionInvalid(let message), .selfReadingRequired(let message),
             .dependencyNotReady(let message), .generationTimeout(let message): message
        case .paymentRequired(let message), .rateLimited(let message): message
        case .server(let message): message
        }
    }
}

struct ChatAnswer {
    let text: String
    let suggestions: [String]
}

enum ChatEvent: Sendable {
    case delta(String)
    case meta([String])
    case done
}

@MainActor
struct APIClient {
    static let shared = APIClient()
    private static let logger = Logger(subsystem: "com.onsai.fatelab", category: "network")
    private let transport: URLSession
    private let reportStore: PendingReportStore
    private var generationStore: PendingGenerationStore { .init(storage: reportStore) }
    private let questionStore: PendingQuestionStore
    private var chatStore: PendingQuestionStore { var store = questionStore; store.namespace = "chat.pending"; return store }
    init(transport: URLSession = .shared, questionStore: PendingQuestionStore = .init(), reportStore: PendingReportStore = .init()) {
        self.transport = transport; self.questionStore = questionStore; self.reportStore = reportStore
    }

    private func request(path: String, method: String = "GET", token: String? = nil, json: Any? = nil) throws -> URLRequest {
        try AppConfig.requireApplicationAPI()
        // `appending(path:)` は `?v=2` までパスとして扱い、`%3Fv=2` に
        // エンコードしてしまう。相対URLとして解決し、クエリを保持する。
        guard let url = URL(string: path, relativeTo: try AppConfig.requireAPIBaseURL())?.absoluteURL else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 40
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Correlation-ID")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let json { request.httpBody = try JSONSerialization.data(withJSONObject: json) }
        return request
    }

    private func eventBytes(for request: URLRequest, auth: AuthStore?) async throws -> URLSession.AsyncBytes {
        let owner = AccountScope(auth)
        var call = request, refreshed = false
        while true {
            try owner.check(auth)
            let (bytes, response) = try await transport.bytes(for: call)
            try owner.check(auth)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            if http.statusCode == 401, let auth, !refreshed {
                let token = try await auth.validAccessToken(forceRefresh: true)
                try owner.check(auth)
                call.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                refreshed = true
                continue
            }
            if 200..<300 ~= http.statusCode { return bytes }
            var body = Data()
            for try await byte in bytes {
                try owner.check(auth)
                guard body.count < 65536 else { throw APIError.invalidResponse }
                body.append(byte)
            }
            let object = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
            let message = object?["error"] as? String ?? "通信を完了できませんでした"
            if http.statusCode == 401, let auth {
                auth.requireReauthentication(); AuthPresentation.shared.isPresented = true
                throw APIError.authSessionInvalid(message)
            }
            switch object?["code"] as? String {
            case "SELF_READING_REQUIRED": throw APIError.selfReadingRequired(message)
            case "DEPENDENCY_NOT_READY": throw APIError.dependencyNotReady(message)
            case "GENERATION_TIMEOUT": throw APIError.generationTimeout(message)
            default: break
            }
            switch http.statusCode {
            case 402: throw APIError.paymentRequired(message)
            case 429: throw APIError.rateLimited(message)
            case 503: throw APIError.dependencyNotReady(message)
            default: throw APIError.http(status: http.statusCode, message: message)
            }
        }
    }

    private func data(for request: URLRequest, retryTransient: Bool = false, auth: AuthStore? = nil) async throws -> Data {
        let owner = AccountScope(auth)
        let maximumAttempts = (retryTransient ? 3 : 1) + (auth == nil ? 0 : 1)
        var lastError: Error = APIError.invalidResponse
        var currentRequest = request
        var retriedAfterRefresh = false
        let deadline = ContinuousClock.now.advanced(by: .seconds(45))

        for attempt in 0..<maximumAttempts {
            do {
                try owner.check(auth)
                guard ContinuousClock.now < deadline else { throw APIError.timeout }
                let remaining = ContinuousClock.now.duration(to: deadline).components
                let remainingSeconds = Double(remaining.seconds) + Double(remaining.attoseconds) / 1_000_000_000_000_000_000
                currentRequest.timeoutInterval = min(40, max(0.1, remainingSeconds))
                let (data, response) = try await Self.boundedData(for: currentRequest, transport: transport, timeout: .seconds(remainingSeconds))
                try owner.check(auth)
                guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
                if auth == nil, http.statusCode == 304,
                   let cached = URLCache.shared.cachedResponse(for: currentRequest)?.data {
                    return cached
                }
                if 200..<300 ~= http.statusCode { return data }

                if http.statusCode == 401, let auth, !retriedAfterRefresh {
                    let token = try await auth.validAccessToken(forceRefresh: true)
                    try owner.check(auth)
                    currentRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    retriedAfterRefresh = true
                    continue
                }
                if http.statusCode == 401, let auth {
                    auth.requireReauthentication()
                    AuthPresentation.shared.isPresented = true
                }

                let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                let serverMessage = ["error", "message", "detail"]
                    .compactMap { object?[$0] as? String }
                    .first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                let message = serverMessage ?? "一時的に接続できませんでした。もう一度お試しください"
                let apiCode = object?["code"] as? String
                let error: APIError = switch apiCode {
                case "AUTH_SESSION_INVALID": .authSessionInvalid(message)
                case "SELF_READING_REQUIRED": .selfReadingRequired(message)
                case "DEPENDENCY_NOT_READY": .dependencyNotReady(message)
                case "GENERATION_TIMEOUT": .generationTimeout(message)
                default: switch http.statusCode {
                case 402: .paymentRequired(message)
                case 429: .rateLimited("アクセスが集中しています。少し待ってから、もう一度お試しください")
                default: .http(status: http.statusCode, message: message)
                }
                }
                lastError = error
                let transientStatusCodes = [500, 502, 503, 504]
                if retryTransient, attempt + 1 < maximumAttempts, transientStatusCodes.contains(http.statusCode) {
                    let delay = 2 * (attempt + 1)
                    guard ContinuousClock.now.advanced(by: .seconds(delay)) < deadline else { throw APIError.timeout }
                    try await Task.sleep(for: .seconds(delay))
                    continue
                }
                logFailure(currentRequest, status: http.statusCode, error: error)
                throw error
            } catch {
                try owner.check(auth)
                let normalizedError: Error
                if let urlError = error as? URLError, urlError.code == .timedOut {
                    normalizedError = APIError.timeout
                } else {
                    normalizedError = error
                }
                lastError = normalizedError
                let transientCodes: Set<URLError.Code> = [
                    .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
                    .networkConnectionLost, .notConnectedToInternet,
                ]
                if retryTransient, attempt + 1 < maximumAttempts,
                   let urlError = error as? URLError, transientCodes.contains(urlError.code) {
                    let delay = 2 * (attempt + 1)
                    guard ContinuousClock.now.advanced(by: .seconds(delay)) < deadline else { throw APIError.timeout }
                    try await Task.sleep(for: .seconds(delay))
                    continue
                }
                if userFacingErrorMessage(normalizedError) != nil { logFailure(currentRequest, error: normalizedError) }
                throw normalizedError
            }
        }
        throw lastError
    }

    /// Request timeouts measure idle time; this deadline also stops a response that
    /// keeps sending bytes without ever finishing. URLSession cooperates with cancellation.
    static func boundedData(for request: URLRequest, transport: URLSession, timeout: Duration) async throws -> (Data, URLResponse) {
        try await withThrowingTaskGroup(of: (Data, URLResponse).self) { group in
            group.addTask { try await transport.data(for: request) }
            group.addTask {
                try await Task.sleep(for: timeout)
                throw APIError.timeout
            }
            defer { group.cancelAll() }
            guard let result = try await group.next() else { throw CancellationError() }
            return result
        }
    }

    private func logFailure(_ request: URLRequest, status: Int? = nil, error: Error) {
        let requestId = request.value(forHTTPHeaderField: "X-Correlation-ID") ?? "missing"
        let path = request.url?.path ?? "unknown"
        Self.logger.error("API request failed correlationId=\(requestId, privacy: .public) status=\(status ?? 0) path=\(path, privacy: .public) error=\(String(describing: type(of: error)), privacy: .public)")
    }

    func warmup() async {
        guard let call = try? request(path: "/health") else { return }
        _ = try? await data(for: call, retryTransient: true)
    }

    func status(auth: AuthStore) async throws -> ReadingStatus {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/status", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(ReadingStatus.self, from: raw)
    }

    func bookCall<T: Decodable>(_ type: T.Type, path: String, method: String = "GET", json: Any? = nil, auth: AuthStore, aiConsentVersion: String? = nil) async throws -> T {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        var call = try request(path: "/api/books" + path, method: method, token: token, json: json)
        if let aiConsentVersion { call.setValue(aiConsentVersion, forHTTPHeaderField: "X-FateLab-AI-Consent") }
        let raw = try await data(for: call, auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(type, from: raw)
    }

    func readings(auth: AuthStore) async throws -> [ReadingSummary] {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/conversations", token: token), retryTransient: true, auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["conversations"] ?? [])
        return try JSONDecoder().decode([ReadingSummary].self, from: list)
    }

    func compatibilityHistory(partnerID: UUID, auth: AuthStore) async throws -> CompatibilityHistory {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        return try await CompatibilityHistory.load { cursor in
            try owner.check(auth)
            let raw = try await data(for: request(path: CompatibilityHistory.path(partnerID: partnerID, cursor: cursor), token: token), retryTransient: true, auth: auth)
            try owner.check(auth)
            return try JSONDecoder().decode(CompatibilityHistory.Page.self, from: raw)
        }
    }

    func traits(auth: AuthStore) async throws -> [ProfileTrait] {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/profile/traits", token: token), retryTransient: true, auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["traits"] ?? [])
        return try JSONDecoder().decode([ProfileTrait].self, from: list)
    }

    func deleteTrait(id: UUID, auth: AuthStore) async throws {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        _ = try await data(for: request(path: "/api/reading/profile/traits/\(id.uuidString)", method: "DELETE", token: token), auth: auth)
    }

    func partnerProfiles(auth: AuthStore) async throws -> PartnerProfilesResponse {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/partners", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(PartnerProfilesResponse.self, from: raw)
    }

    private func partnerRegistrationStore() throws -> PendingPartnerRegistrationStore {
        guard AppConfig.authenticationConfigurationIsValid else { throw APIError.invalidResponse }
        let api = try AppConfig.requireAPIBaseURL()
        let environment = Data("\(api.absoluteString)|\(AppConfig.supabaseURL.absoluteString)".utf8).base64EncodedString()
        return .init(storage: reportStore, environment: environment)
    }

    func createPartner(displayName: String, birthDate: String, birthTime: String?, birthplace: String,
                       gender: String, relationshipType: String, relationshipLabel: String, auth: AuthStore) async throws -> PartnerProfile {
        let owner = AccountScope(auth)
        guard let userID = owner.userID else { throw APIError.invalidResponse }
        let store = try partnerRegistrationStore()
        var body: [String: Any] = ["displayName": displayName, "birthDate": birthDate, "birthplace": birthplace,
                                   "gender": gender, "relationshipType": relationshipType, "relationshipLabel": relationshipLabel]
        if let birthTime { body["birthTime"] = birthTime }
        let payload = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        if let old = try store.load(owner: userID) {
            guard old.payload == payload else { throw APIError.server("前の登録状況を確認するか、登録を取り消してください") }
        } else {
            try store.save(.init(version: 1, operationID: UUID(), ownerID: userID, authEpoch: owner.epoch,
                                 environment: store.environment, payload: payload), owner: userID)
        }
        guard let partner = try await recoverPartnerRegistration(auth: auth) else { throw APIError.invalidResponse }
        return partner
    }

    /// Check the server first, including after relaunch. Only not_found permits resending.
    func recoverPartnerRegistration(auth: AuthStore, cancel: Bool = false) async throws -> PartnerProfile? {
        let owner = AccountScope(auth)
        guard let userID = owner.userID else { throw APIError.invalidResponse }
        let store = try partnerRegistrationStore()
        guard let pending = try store.load(owner: userID) else { return nil }
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let path = "/api/partners/registration/operations/\(pending.operationID.uuidString)"
        let raw = try await data(for: request(path: path + (cancel ? "/cancel" : ""), method: cancel ? "POST" : "GET", token: token), auth: auth)
        try owner.check(auth)
        let status = try JSONDecoder().decode(PartnerRegistrationStatus.self, from: raw)
        switch status.state {
        case "completed":
            guard let partner = status.partner else { throw APIError.invalidResponse }
            try store.clear(operationID: pending.operationID, owner: userID)
            return partner
        case "cancelled", "deleted":
            try store.clear(operationID: pending.operationID, owner: userID)
            if cancel { return nil }
            throw APIError.server(status.state == "cancelled" ? "この登録操作は取消済みです" : "この操作で登録した相手は削除済みです")
        case "not_found" where !cancel:
            var call = try request(path: "/api/partners", method: "POST", token: token)
            call.setValue(pending.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
            call.httpBody = pending.payload
            let result = try await data(for: call, auth: auth)
            try owner.check(auth)
            struct Response: Decodable { let partner: PartnerProfile }
            let partner = try JSONDecoder().decode(Response.self, from: result).partner
            try store.clear(operationID: pending.operationID, owner: userID)
            return partner
        default:
            // Unknown responses and transport errors retain the exact operation.
            throw APIError.server("登録状況を確定できません。同じ操作で再確認してください")
        }
    }

    func deletePartner(id: UUID, auth: AuthStore) async throws {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        _ = try await data(for: request(path: "/api/partners/\(id.uuidString)", method: "DELETE", token: token), auth: auth)
    }

    private func recoveredCompatibility(_ raw: [String: Any], conversationID: String) throws -> StructuredReportResponse {
        guard UUID(uuidString: conversationID) != nil else { throw APIError.invalidResponse }
        var value = raw
        value["conversationId"] = conversationID
        let report = try JSONDecoder().decode(StructuredReportResponse.self, from: JSONSerialization.data(withJSONObject: value))
        guard [2, 3].contains(report.version), !report.reportText.isEmpty, !report.cards.isEmpty else { throw APIError.invalidResponse }
        return report
    }

    func compatibility(partnerID: UUID, conversationID: UUID, relationshipType: String, relationshipLabel: String, auth: AuthStore, progress: @MainActor (GenerationProgress) -> Void = { _ in }) async throws -> StructuredReportResponse {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        guard let userID = owner.userID else { throw APIError.invalidResponse }
        let storage = PendingCompatibilityStore(storage: reportStore)
        let payload = try JSONSerialization.data(withJSONObject: ["relationshipType": relationshipType, "relationshipLabel": relationshipLabel, "conversationId": conversationID.uuidString], options: [.sortedKeys])
        let pending = try storage.load(owner: userID)
        if let pending {
            guard pending.partnerID == partnerID, pending.payload == payload else { throw APIError.server("前の相性鑑定の生成状況を確認してから入力を変更してください") }
            let raw = try await data(for: request(path: "/api/partners/compatibility/operations/\(pending.operationID.uuidString)", token: token), auth: auth)
            try owner.check(auth)
            guard let state = try JSONSerialization.jsonObject(with: raw) as? [String: Any] else { throw APIError.invalidResponse }
            switch state["state"] as? String {
            case "completed":
                guard let result = state["result"] as? [String: Any], let id = state["conversationId"] as? String else { throw APIError.invalidResponse }
                let report = try recoveredCompatibility(result, conversationID: id)
                try storage.clear(operationID: pending.operationID, owner: userID)
                return report
            case "not_found": break
            case "failed", "deleted":
                try storage.clear(operationID: pending.operationID, owner: userID)
                throw APIError.server("前の相性鑑定は完了しなかったか削除済みです。もう一度操作すると新しく生成します")
            case "pending": throw APIError.server("相性鑑定を生成中です。少し待ってから状況を確認してください")
            default: throw APIError.invalidResponse
            }
        }
        let operation = pending ?? PendingCompatibility(operationID: UUID(), partnerID: partnerID, payload: payload)
        try storage.save(operation, owner: userID)
        var call = try request(path: "/api/partners/\(partnerID.uuidString)/compatibility?format=sse", method: "POST", token: token)
        call.httpBody = operation.payload
        call.setValue(operation.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
        let bytes: URLSession.AsyncBytes
        do { bytes = try await eventBytes(for: call, auth: auth) }
        catch APIError.paymentRequired(let message) {
            try owner.check(auth)
            try storage.clear(operationID: operation.operationID, owner: userID)
            throw APIError.paymentRequired(message)
        }
        catch APIError.http(status: let status, message: let message) where status == 400 || status == 404 {
            try owner.check(auth)
            try storage.clear(operationID: operation.operationID, owner: userID)
            throw APIError.http(status: status, message: message)
        }
        var result: StructuredReportResponse?
        var parser = ServerEventParser()
        for try await byte in bytes {
            try owner.check(auth)
            guard let event = try parser.push(byte) else { continue }
            switch event {
            case .progress(let value): progress(value)
            case .report(let data, let conversationID):
                guard result == nil else { throw APIError.invalidResponse }
                guard let report = try JSONSerialization.jsonObject(with: data) as? [String: Any], let conversationID else { throw APIError.invalidResponse }
                result = try recoveredCompatibility(report, conversationID: conversationID)
            case .done: break
            default: throw APIError.invalidResponse
            }
            if parser.ended { break }
        }
        try parser.finish(complete: result != nil)
        try owner.check(auth)
        guard let result else { throw APIError.invalidResponse }
        try storage.clear(operationID: operation.operationID, owner: userID)
        return result
    }

    func readingAccess(target: ReadingPurchaseTarget, unlock: Bool = false, auth: AuthStore) async throws -> ReadingAccessResponse {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let payload = try await data(for: request(path: "/api/reading-access/" + (unlock ? "unlock" : "status"), method: "POST", token: token,
            json: ["conversationId": target.conversationId.uuidString, "cardId": target.cardId]), auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(ReadingAccessResponse.self, from: payload)
    }

    func verifyApplePurchase(signedTransaction: String, allowOwnerTransfer: Bool = false, operationID: UUID? = nil, auth: AuthStore) async throws -> ApplePurchaseVerification {
        try AppConfig.requireStoreKit()
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        var body: [String: Any] = ["signedTransaction": signedTransaction, "allowOwnerTransfer": allowOwnerTransfer]
        if let operationID { body["operationId"] = operationID.uuidString }
        let payload = try await data(for: request(path: "/api/apple/transactions/verify", method: "POST", token: token, json: body), auth: auth)
        return try JSONDecoder().decode(ApplePurchaseVerification.self, from: payload)
    }

    func retainAppleSignInToken(authorizationCode: String, auth: AuthStore) async throws {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        _ = try await data(for: request(path: "/api/apple/sign-in-token", method: "POST", token: token,
                                       json: ["authorizationCode": authorizationCode]), auth: auth)
    }

    func deleteAccount(auth: AuthStore) async throws {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        _ = try await data(for: request(path: "/api/reading/account", method: "DELETE", token: token), auth: auth)
    }

    func pendingReport(auth: AuthStore) throws -> GeneratedReport? {
        guard let userID = auth.userID else { return nil }
        return try reportStore.load(owner: userID)?.restored()
    }

    func createConversation(report: GeneratedReport, auth: AuthStore) async throws -> UUID {
        let owner = AccountScope(auth)
        try owner.check(auth)
        guard let userID = owner.userID else { throw APIError.invalidResponse }
        let snapshot = try PendingReport(report)
        try reportStore.save(snapshot, owner: userID)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        var call = try request(path: "/api/reading/conversations", method: "POST", token: token)
        call.httpBody = snapshot.payload
        call.setValue(snapshot.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
        let raw: Data
        do { raw = try await data(for: call, auth: auth) }
        catch APIError.http(status: 410, message: let message) {
            try owner.check(auth)
            try generationStore.clear(operationID: snapshot.operationID, owner: userID)
            try reportStore.clear(operationID: snapshot.operationID, owner: userID)
            throw APIError.http(status: 410, message: message)
        }
        try owner.check(auth)
        guard let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let id = object["id"] as? String, let uuid = UUID(uuidString: id),
              let revision = object["revisionId"] as? String, UUID(uuidString: revision) != nil else { throw APIError.invalidResponse }
        try generationStore.clear(operationID: snapshot.operationID, owner: userID)
        try reportStore.clear(operationID: snapshot.operationID, owner: userID)
        SavedReadingMemoryCache.shared.seed(report, id: uuid, owner: owner)
        return uuid
    }

    func conversation(id: UUID, auth: AuthStore) async throws -> ConversationDetail {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(ConversationDetail.self, from: raw)
    }

    func createChatConversation(sourceID: UUID, question: String, auth: AuthStore) async throws -> UUID {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        guard let userID = owner.userID else { throw APIError.invalidResponse }
        let question = question.replacingOccurrences(of: "\r\n", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, question.utf16.count <= 1200,
              !question.unicodeScalars.contains(where: { ($0.value < 32 && $0.value != 9 && $0.value != 10 && $0.value != 13) || $0.value == 127 }) else {
            throw APIError.server("質問は1200文字以内で入力してください")
        }
        var pending = try chatStore.load(owner: userID, conversation: sourceID)
        if let prior = pending, prior.question != question {
            if let chatID = prior.createdConversationID {
                let child = PendingQuestion(operationID: prior.operationID, conversationID: chatID, question: prior.question, sourceConversationID: sourceID)
                let status = try await questionStatus(child, auth: auth)
                try owner.check(auth)
                guard ["completed", "failed", "deleted"].contains(status.state) else { throw APIError.server("前の対話の作成を確認中です。元の質問で再試行してください") }
                try chatStore.clear(owner: userID, conversation: sourceID)
                pending = nil
            } else { throw APIError.server("前の対話の作成を確認中です。元の質問で再試行してください") }
        }
        var operation = pending ?? PendingQuestion(operationID: UUID(), conversationID: sourceID, question: question)
        try chatStore.save(operation, owner: userID)
        var call = try request(path: "/api/reading/conversations/\(sourceID.uuidString)/chat", method: "POST", token: token, json: ["question": question])
        call.setValue(operation.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
        let raw: Data
        do { raw = try await data(for: call, auth: auth) }
        catch APIError.http(status: 410, message: let message) {
            try owner.check(auth)
            if let childID = operation.createdConversationID,
               let child = try questionStore.load(owner: userID, conversation: childID), child.operationID == operation.operationID {
                try clearQuestion(child, owner: userID)
            } else { try chatStore.clear(owner: userID, conversation: sourceID) }
            throw APIError.http(status: 410, message: message)
        }
        try owner.check(auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        guard let value = object?["id"] as? String, let id = UUID(uuidString: value) else { throw APIError.invalidResponse }
        let child = PendingQuestion(operationID: operation.operationID, conversationID: id, question: question, sourceConversationID: sourceID)
        if let existing = try questionStore.load(owner: userID, conversation: id), existing.operationID != child.operationID {
            throw APIError.server("この対話には未完了の質問があります。履歴から開いてください")
        }
        try questionStore.save(child, owner: userID)
        operation.createdConversationID = id
        try chatStore.save(operation, owner: userID)
        return id
    }

    private func clearQuestion(_ pending: PendingQuestion, owner: UUID) throws {
        if let source = pending.sourceConversationID,
           let creation = try chatStore.load(owner: owner, conversation: source), creation.operationID == pending.operationID {
            try chatStore.clear(owner: owner, conversation: source)
        }
        try questionStore.clear(owner: owner, conversation: pending.conversationID)
    }

    func setConversationSaved(id: UUID, isSaved: Bool, auth: AuthStore) async throws {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        _ = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)/saved",
                                       method: "PATCH", token: token, json: ["isSaved": isSaved]), auth: auth)
    }

    func selfTimingHistory(id: UUID, auth: AuthStore) async throws -> SelfTimingHistory {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/timing-history", token: token), retryTransient: true, auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(SelfTimingHistory.self, from: raw)
    }

    func coupleMeetingSettings(partnerID: UUID, selfReadingID: UUID?, saving: Bool, meetingYear: Int?, auth: AuthStore) async throws -> CoupleMeetingSettings {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let value: Any = meetingYear.map { $0 as Any } ?? NSNull()
        let query = selfReadingID.map { "?selfReadingId=\($0.uuidString)" } ?? ""
        let raw = try await data(for: request(path: "/api/reading/couple-timeline-settings/\(partnerID.uuidString)\(query)", method: saving ? "PATCH" : "GET", token: token, json: saving ? ["meetingYear": value] : nil), auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(CoupleMeetingSettings.self, from: raw)
    }

    func coupleAllYears(id: UUID, auth: AuthStore) async throws -> CoupleAllYearsHistory {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/couple-timeline", token: token), retryTransient: true, auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(CoupleAllYearsHistory.self, from: raw)
    }

    func saveCoupleMeetingYear(id: UUID, meetingYear: Int?, auth: AuthStore) async throws -> CoupleAllYearsHistory {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let value: Any = meetingYear.map { $0 as Any } ?? NSNull()
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/couple-timeline", method: "PATCH", token: token, json: ["meetingYear": value]), auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(CoupleAllYearsHistory.self, from: raw)
    }

    func coupleTimingHistory(id: UUID, auth: AuthStore) async throws -> CoupleTimingHistory {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/timing-history", token: token), retryTransient: true, auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(CoupleTimingHistory.self, from: raw)
    }

    func partnerReading(id: UUID, auth: AuthStore) async throws -> StructuredReportResponse {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/partner-reading", token: token), retryTransient: true, auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(StructuredReportResponse.self, from: raw)
    }

    func cards(id: UUID, auth: AuthStore) async throws -> StructuredReportResponse {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/cards", token: token), retryTransient: true, auth: auth)
        try owner.check(auth)
        let report = try JSONDecoder().decode(StructuredReportResponse.self, from: raw)
        SavedReadingMemoryCache.shared.seedResponse(report, id: id, owner: owner)
        return report
    }

    func ask(conversationID: UUID, question: String, auth: AuthStore) async throws -> ChatAnswer {
        var text = "", suggestions: [String] = []
        for try await event in askStream(conversationID: conversationID, question: question, auth: auth) {
            switch event {
            case .delta(let part): text += part
            case .meta(let values): suggestions = values
            case .done: break
            }
        }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw APIError.invalidResponse }
        return ChatAnswer(text: text, suggestions: suggestions)
    }

    private func questionStatus(_ pending: PendingQuestion, auth: AuthStore) async throws -> QuestionOperationStatus {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/reading/conversations/\(pending.conversationID.uuidString)/questions/\(pending.operationID.uuidString)", token: token), auth: auth)
        try owner.check(auth)
        let status = try JSONDecoder().decode(QuestionOperationStatus.self, from: raw)
        guard ["pending", "completed", "failed", "not_found", "deleted"].contains(status.state),
              status.state != "completed" || status.result != nil else { throw APIError.invalidResponse }
        return status
    }

    func recoverQuestionDraft(conversationID: UUID, auth: AuthStore) async throws -> String? {
        let owner = AccountScope(auth)
        guard let userID = owner.userID else { return nil }
        guard let pending = try questionStore.load(owner: userID, conversation: conversationID) else {
            return try chatStore.load(owner: userID, conversation: conversationID)?.question
        }
        let status = try await questionStatus(pending, auth: auth)
        try owner.check(auth)
        if ["completed", "failed", "deleted"].contains(status.state) {
            try clearQuestion(pending, owner: userID)
        }
        return status.state == "completed" || status.state == "deleted" ? nil : pending.question
    }

    func askStream(conversationID: UUID, question: String, auth: AuthStore, aiConsentVersion: String? = nil) -> AsyncThrowingStream<ChatEvent, Error> {
        let owner = AccountScope(auth)
        let question = question.replacingOccurrences(of: "\r\n", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return AsyncThrowingStream { continuation in
            let task = Task { @MainActor in
                do {
                    try owner.check(auth)
                    let token = try await auth.validAccessToken()
                    try owner.check(auth)
                    guard !question.isEmpty, question.utf16.count <= 1200,
                          !question.unicodeScalars.contains(where: { ($0.value < 32 && $0.value != 9 && $0.value != 10 && $0.value != 13) || $0.value == 127 }) else {
                        throw APIError.server("質問は1200文字以内で入力してください")
                    }
                    guard let userID = owner.userID else { throw APIError.invalidResponse }
                    var pending = try questionStore.load(owner: userID, conversation: conversationID)
                    if let prior = pending {
                        let status = try await questionStatus(prior, auth: auth)
                        try owner.check(auth)
                        if status.state == "completed", prior.question == question, let result = status.result {
                            try clearQuestion(prior, owner: userID)
                            continuation.yield(.delta(result.answer)); continuation.yield(.meta(result.suggestions))
                            continuation.yield(.done); continuation.finish(); return
                        }
                        if ["completed", "failed", "deleted"].contains(status.state) {
                            try clearQuestion(prior, owner: userID)
                            pending = nil
                            if status.state != "completed" { throw APIError.server("前の質問は保存されませんでした。もう一度送信してください") }
                        } else if status.state == "pending" || prior.question != question {
                            throw APIError.server("前の質問の保存状況を確認中です。少し待ってから再試行してください")
                        }
                    }
                    let operation = pending ?? PendingQuestion(operationID: UUID(), conversationID: conversationID, question: question)
                    // Persist before sending: network ambiguity must keep this exact operation ID.
                    try questionStore.save(operation, owner: userID)
                    var call = try request(path: "/api/reading/conversations/\(conversationID.uuidString)/questions",
                                           method: "POST", token: token, json: ["question": question])
                    call.setValue(operation.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
                    if let aiConsentVersion { call.setValue(aiConsentVersion, forHTTPHeaderField: "X-FateLab-AI-Consent") }
                    let bytes = try await eventBytes(for: call, auth: auth)
                    var parser = ServerEventParser()
                    var hasText = false, hasMetadata = false
                    for try await byte in bytes {
                        try owner.check(auth)
                        guard let event = try parser.push(byte) else { continue }
                        switch event {
                        case .delta(let text): hasText = hasText || !text.isEmpty; continuation.yield(.delta(text))
                        case .meta(let values): hasMetadata = true; continuation.yield(.meta(values))
                        case .done: break
                        default: throw APIError.invalidResponse
                        }
                        if parser.ended { break }
                    }
                    try parser.finish(complete: parser.ended && hasText && hasMetadata)
                    try owner.check(auth)
                    try clearQuestion(operation, owner: userID)
                    continuation.yield(.done); continuation.finish(); return
                } catch is CancellationError {
                    continuation.finish(throwing: CancellationError())
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func recoveredGeneration(_ raw: [String: Any], operation: PendingGeneration) throws -> GeneratedReport {
        let report = try JSONDecoder().decode(StructuredReportResponse.self, from: JSONSerialization.data(withJSONObject: raw))
        guard [2, 3].contains(report.version), !report.reportText.isEmpty, !report.cards.isEmpty else { throw APIError.invalidResponse }
        return GeneratedReport(birthData: try operation.birth(), calculatedData: try operation.calculated(), text: report.reportText,
                               cards: report.cards, chartSections: report.chartSections ?? [], structuredSnapshot: raw, saveOperationID: operation.operationID)
    }

    func generateReport(input: BirthInput, auth: AuthStore? = nil,
                        progress: @MainActor (GenerationProgress) -> Void = { _ in }) async throws -> GeneratedReport {
        let owner = AccountScope(auth)
        let calendar = Calendar(identifier: .gregorian)
        let parts = calendar.dateComponents([.year, .month, .day], from: input.date)
        let time = input.birthTime.map { calendar.dateComponents([.hour, .minute], from: $0) }
        let date = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
        let birthTime = time.map { String(format: "%02d:%02d", $0.hour!, $0.minute!) } ?? ""
        var birthData: [String: Any] = ["birthDate": date, "birthTime": birthTime, "nickname": input.nickname,
                                        "birthplace": input.birthplace, "gender": input.gender]
        if let value = input.spouseConvention { birthData["spouseConvention"] = value }
        if let value = input.annualYunConvention { birthData["annualYunConvention"] = value }
        if let value = input.workContext { birthData["workContext"] = value }
        if let value = input.relationshipStatus { birthData["relationshipStatus"] = value }
        if let userID = owner.userID, let pending = try reportStore.load(owner: userID) {
            let restored = try pending.restored()
            guard NSDictionary(dictionary: restored.birthData).isEqual(to: birthData) else {
                throw APIError.server("未保存の鑑定があります。先に保存を完了してください")
            }
            return restored
        }
        let token: String? = if let auth, auth.session != nil { try await auth.validAccessToken() } else { nil }
        try owner.check(auth)
        var operation: PendingGeneration?
        if let userID = owner.userID { operation = try generationStore.load(owner: userID) }
        if let pending = operation {
            progress(.recovering)
            guard NSDictionary(dictionary: try pending.birth()).isEqual(to: birthData) else { throw APIError.server("前の鑑定生成を確認してから入力を変更してください") }
            let raw = try await data(for: request(path: "/api/preview/generations/\(pending.operationID.uuidString)", token: token), auth: auth)
            try owner.check(auth)
            guard let state = try JSONSerialization.jsonObject(with: raw) as? [String: Any] else { throw APIError.invalidResponse }
            switch state["state"] as? String {
            case "completed":
                guard let report = state["result"] as? [String: Any] else { throw APIError.invalidResponse }
                let generated = try recoveredGeneration(report, operation: pending)
                if let userID = owner.userID {
                    try reportStore.save(PendingReport(generated), owner: userID)
                    try generationStore.clear(operationID: pending.operationID, owner: userID)
                }
                return generated
            case "not_found": break // Same ID and exact payload, never a new operation.
            case "failed":
                if let userID = owner.userID { try generationStore.clear(operationID: pending.operationID, owner: userID) }
                throw APIError.server("前の生成は完了しませんでした。もう一度操作すると新しく生成します")
            case "pending": throw APIError.server("鑑定を生成中です。少し待ってから状況を確認してください")
            default: throw APIError.invalidResponse
            }
        }
        if operation == nil {
            progress(.preparing)
            let calcData = try await data(for: request(path: "/api/calc/divination", method: "POST", token: token, json: birthData), retryTransient: true, auth: auth)
            try owner.check(auth)
            guard let calculated = try JSONSerialization.jsonObject(with: calcData) as? [String: Any] else { throw APIError.invalidResponse }
            let body: [String: Any] = birthData.merging(["question": "", "calculatedData": calculated]) { _, new in new }
            operation = PendingGeneration(operationID: UUID(), birthData: try JSONSerialization.data(withJSONObject: birthData, options: [.sortedKeys]), payload: try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]))
        }
        guard let operation else { throw APIError.invalidResponse }
        let calculated = try operation.calculated()
        if let userID = owner.userID { try generationStore.save(operation, owner: userID) }
        var call = try request(path: "/api/preview/generate?format=sse", method: "POST", token: token)
        call.httpBody = operation.payload
        call.setValue(operation.operationID.uuidString, forHTTPHeaderField: "Idempotency-Key")
        call.timeoutInterval = 120
        progress(.requesting)
        let bytes = try await eventBytes(for: call, auth: auth)
        var structured: StructuredReportResponse?
        var structuredSnapshot: [String: Any]?
        var completedReport: GeneratedReport?
        var parser = ServerEventParser()
        for try await byte in bytes {
            try owner.check(auth)
            guard let event = try parser.push(byte) else { continue }
            switch event {
            case .progress(let value): progress(value)
            case .report(let data, _):
                guard structured == nil else { throw APIError.invalidResponse }
                structured = try JSONDecoder().decode(StructuredReportResponse.self, from: data)
                structuredSnapshot = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                guard let structured, !structured.reportText.isEmpty, !structured.cards.isEmpty else { throw APIError.invalidResponse }
                let generated = GeneratedReport(birthData: birthData, calculatedData: calculated, text: structured.reportText, cards: structured.cards, chartSections: structured.chartSections ?? [], structuredSnapshot: structuredSnapshot, saveOperationID: operation.operationID)
                if let userID = owner.userID {
                    try reportStore.save(PendingReport(generated), owner: userID)
                    try generationStore.clear(operationID: operation.operationID, owner: userID)
                }
                completedReport = generated
            case .done: break
            default: throw APIError.invalidResponse
            }
            if parser.ended { break }
        }
        try parser.finish(complete: structured != nil)
        try owner.check(auth)
        guard let generated = completedReport else { throw APIError.invalidResponse }
        return generated
    }
}


extension APIClient {
    func timelineCall<T: Decodable>(_ type: T.Type, path: String, method: String = "GET", json: [String: Any]? = nil, auth: AuthStore) async throws -> T {
        let owner = AccountScope(auth)
        let token = try await auth.validAccessToken()
        try owner.check(auth)
        let raw = try await data(for: request(path: "/api/timeline" + path, method: method, token: token, json: json), auth: auth)
        try owner.check(auth)
        return try JSONDecoder().decode(T.self, from: raw)
    }
}
