import Foundation
import CryptoKit
import OSLog

struct GenerationProgress: Equatable { let percent: Int; let title: String; let detail: String }
enum GenerationKind { case selfReading, compatibility }

enum APIError: LocalizedError {
    case invalidResponse
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
    private init() {}

    private func request(path: String, method: String = "GET", token: String? = nil, json: Any? = nil) throws -> URLRequest {
        // `appending(path:)` は `?v=2` までパスとして扱い、`%3Fv=2` に
        // エンコードしてしまう。相対URLとして解決し、クエリを保持する。
        guard let url = URL(string: path, relativeTo: AppConfig.apiBaseURL)?.absoluteURL else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 40
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Correlation-ID")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let json { request.httpBody = try JSONSerialization.data(withJSONObject: json) }
        return request
    }

    private func data(for request: URLRequest, retryTransient: Bool = false, auth: AuthStore? = nil) async throws -> Data {
        let maximumAttempts = (retryTransient ? 3 : 1) + (auth == nil ? 0 : 1)
        var lastError: Error = APIError.invalidResponse
        var currentRequest = request
        var retriedAfterRefresh = false
        let deadline = ContinuousClock.now.advanced(by: .seconds(45))

        for attempt in 0..<maximumAttempts {
            do {
                guard ContinuousClock.now < deadline else { throw APIError.timeout }
                let remaining = ContinuousClock.now.duration(to: deadline).components
                let remainingSeconds = Double(remaining.seconds) + Double(remaining.attoseconds) / 1_000_000_000_000_000_000
                currentRequest.timeoutInterval = min(40, max(0.1, remainingSeconds))
                let (data, response) = try await URLSession.shared.data(for: currentRequest)
                guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
                if http.statusCode == 304,
                   let cached = URLCache.shared.cachedResponse(for: currentRequest)?.data {
                    return cached
                }
                if 200..<300 ~= http.statusCode { return data }

                if http.statusCode == 401, let auth, !retriedAfterRefresh {
                    let token = try await auth.validAccessToken(forceRefresh: true)
                    currentRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    retriedAfterRefresh = true
                    continue
                }
                if http.statusCode == 401, let auth {
                    auth.signOut()
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
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/status", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(ReadingStatus.self, from: raw)
    }

    func readings(auth: AuthStore) async throws -> [ReadingSummary] {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/conversations", token: token), retryTransient: true, auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["conversations"] ?? [])
        return try JSONDecoder().decode([ReadingSummary].self, from: list)
    }

    func traits(auth: AuthStore) async throws -> [ProfileTrait] {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/profile/traits", token: token), retryTransient: true, auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["traits"] ?? [])
        return try JSONDecoder().decode([ProfileTrait].self, from: list)
    }

    func deleteTrait(id: UUID, auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/reading/profile/traits/\(id.uuidString)", method: "DELETE", token: token), auth: auth)
    }

    func partnerProfiles(auth: AuthStore) async throws -> PartnerProfilesResponse {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/partners", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(PartnerProfilesResponse.self, from: raw)
    }

    func createPartner(displayName: String, birthDate: String, birthTime: String?, birthplace: String,
                       gender: String, relationshipType: String, relationshipLabel: String, auth: AuthStore) async throws -> PartnerProfile {
        let token = try await auth.validAccessToken()
        var body: [String: Any] = ["displayName": displayName, "birthDate": birthDate, "birthplace": birthplace,
                                   "gender": gender, "relationshipType": relationshipType, "relationshipLabel": relationshipLabel]
        if let birthTime { body["birthTime"] = birthTime }
        let raw = try await data(for: request(path: "/api/partners", method: "POST", token: token, json: body), auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let value = try JSONSerialization.data(withJSONObject: object?["partner"] ?? [:])
        return try JSONDecoder().decode(PartnerProfile.self, from: value)
    }

    func deletePartner(id: UUID, auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/partners/\(id.uuidString)", method: "DELETE", token: token), auth: auth)
    }

    func compatibility(partnerID: UUID, conversationID: UUID, relationshipType: String, relationshipLabel: String, auth: AuthStore, progress: @MainActor (GenerationProgress) -> Void = { _ in }) async throws -> StructuredReportResponse {
        let token = try await auth.validAccessToken()
        let call = try request(path: "/api/partners/\(partnerID.uuidString)/compatibility?format=sse", method: "POST", token: token, json: ["relationshipType": relationshipType, "relationshipLabel": relationshipLabel, "conversationId": conversationID.uuidString])
        let (bytes, response) = try await URLSession.shared.bytes(for: call)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard 200..<300 ~= http.statusCode else { var body = ""; for try await line in bytes.lines { body += line }; let object = body.data(using: .utf8).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }; let message = object?["error"] as? String ?? "相性鑑定を作成できませんでした"; if http.statusCode == 402 { throw APIError.paymentRequired(message) }; if http.statusCode == 409 { throw APIError.selfReadingRequired(message) }; throw APIError.http(status: http.statusCode, message: message) }
        var result: StructuredReportResponse?
        for try await line in bytes.lines {
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))
            if payload == "[DONE]" { break }
            guard let data = payload.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            if object["type"] as? String == "progress", let percent = object["percent"] as? Int {
                progress(.init(percent: percent, title: object["title"] as? String ?? "関係を読んでいます", detail: object["detail"] as? String ?? ""))
            }
            if object["type"] as? String == "complete", var report = object["report"] as? [String: Any] {
                report["conversationId"] = object["conversationId"]
                let reportData = try JSONSerialization.data(withJSONObject: report)
                result = try JSONDecoder().decode(StructuredReportResponse.self, from: reportData)
            }
            if object["type"] as? String == "error" {
                throw APIError.server(object["error"] as? String ?? "相性鑑定を作成できませんでした")
            }
        }
        guard let result else { throw APIError.invalidResponse }; return result
    }

    func verifyApplePurchase(signedTransaction: String, auth: AuthStore) async throws -> Bool {
        let token = try await auth.validAccessToken()
        let payload = try await data(for: request(path: "/api/apple/transactions/verify", method: "POST", token: token,
                                         json: ["signedTransaction": signedTransaction]), auth: auth)
        let decoded = try? JSONSerialization.jsonObject(with: payload)
        let object = decoded as? [String: Any]
        return (object?["skipped"] as? Bool) != true
    }

    func retainAppleSignInToken(authorizationCode: String, auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/apple/sign-in-token", method: "POST", token: token,
                                       json: ["authorizationCode": authorizationCode]), auth: auth)
    }

    func deleteAccount(auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/reading/account", method: "DELETE", token: token), auth: auth)
    }

    func createConversation(report: GeneratedReport, auth: AuthStore) async throws -> UUID {
        let token = try await auth.validAccessToken()
        guard JSONSerialization.isValidJSONObject(report.birthData) else { throw APIError.invalidResponse }
        let canonicalBirthData = try JSONSerialization.data(withJSONObject: report.birthData, options: [.sortedKeys])
        let key = SHA256.hash(data: canonicalBirthData).map { String(format: "%02x", $0) }.joined()
        let encodedCards = try JSONEncoder().encode(report.cards)
        let cardObjects = try JSONSerialization.jsonObject(with: encodedCards)
        let encodedSections = try JSONEncoder().encode(report.chartSections)
        let sectionObjects = try JSONSerialization.jsonObject(with: encodedSections)
        var call = try request(path: "/api/reading/conversations", method: "POST", token: token, json: [
            "birthData": report.birthData,
            "calculatedData": report.calculatedData,
            "reportText": report.text,
            "structuredReport": ["version": 3, "reportText": report.text, "cards": cardObjects, "chartSections": sectionObjects],
            "sourceSection": "鑑定全体"
        ])
        call.setValue(key, forHTTPHeaderField: "Idempotency-Key")
        let raw = try await data(for: call, auth: auth)
        guard let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let id = object["id"] as? String, let uuid = UUID(uuidString: id) else { throw APIError.invalidResponse }
        return uuid
    }

    func conversation(id: UUID, auth: AuthStore) async throws -> ConversationDetail {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(ConversationDetail.self, from: raw)
    }

    func createChatConversation(sourceID: UUID, question: String, auth: AuthStore) async throws -> UUID {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/conversations/\(sourceID.uuidString)/chat", method: "POST", token: token,
                                             json: ["question": question]), auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        guard let value = object?["id"] as? String, let id = UUID(uuidString: value) else { throw APIError.invalidResponse }
        return id
    }

    func setConversationSaved(id: UUID, isSaved: Bool, auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)/saved",
                                       method: "PATCH", token: token, json: ["isSaved": isSaved]), auth: auth)
    }

    func cards(id: UUID, auth: AuthStore) async throws -> StructuredReportResponse {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/cards", token: token), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(StructuredReportResponse.self, from: raw)
    }

    func ask(conversationID: UUID, question: String, auth: AuthStore) async throws -> ChatAnswer {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/conversations/\(conversationID.uuidString)/questions",
                                               method: "POST", token: token, json: ["question": question]), auth: auth)
        var suggestions: [String] = []
        let text = String(decoding: raw, as: UTF8.self).split(separator: "\n").reduce(into: "") { result, line in
            guard line.hasPrefix("data: ") else { return }
            let payload = String(line.dropFirst(6))
            guard payload != "[DONE]", let chunk = payload.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: chunk) as? [String: Any] else { return }
            if let delta = object["delta"] as? [String: Any], let part = delta["text"] as? String { result += part }
            if let meta = object["meta"] as? [String: Any], let values = meta["suggestions"] as? [String] { suggestions = values }
        }
        let cleaned = text.replacingOccurrences(of: #"(?m)^次の質問[：:].*$"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { throw APIError.server("回答を取得できませんでした") }
        return ChatAnswer(text: cleaned, suggestions: suggestions)
    }

    func askStream(conversationID: UUID, question: String, auth: AuthStore) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task { @MainActor in
                do {
                    var token = try await auth.validAccessToken()
                    var call = try request(path: "/api/reading/conversations/\(conversationID.uuidString)/questions",
                                           method: "POST", token: token, json: ["question": question])
                    var refreshed = false
                    while true {
                        let (bytes, response) = try await URLSession.shared.bytes(for: call)
                        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
                        if http.statusCode == 401, !refreshed {
                            token = try await auth.validAccessToken(forceRefresh: true)
                            call.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                            refreshed = true
                            continue
                        }
                        guard 200..<300 ~= http.statusCode else {
                            var body = ""
                            for try await line in bytes.lines { body += line }
                            let object = body.data(using: .utf8).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
                            let message = object?["error"] as? String ?? "読み解きを続けられませんでした"
                            let code = object?["code"] as? String
                            if code == "AUTH_SESSION_INVALID" {
                                auth.signOut(); AuthPresentation.shared.isPresented = true
                                throw APIError.authSessionInvalid(message)
                            }
                            if code == "SELF_READING_REQUIRED" { throw APIError.selfReadingRequired(message) }
                            if code == "DEPENDENCY_NOT_READY" { throw APIError.dependencyNotReady(message) }
                            if code == "GENERATION_TIMEOUT" { throw APIError.generationTimeout(message) }
                            if http.statusCode == 402 { throw APIError.paymentRequired(message) }
                            if http.statusCode == 429 { throw APIError.rateLimited(message) }
                            throw APIError.http(status: http.statusCode, message: message)
                        }
                        for try await line in bytes.lines {
                            try Task.checkCancellation()
                            guard line.hasPrefix("data: ") else { continue }
                            let payload = String(line.dropFirst(6))
                            if payload == "[DONE]" { continuation.yield(.done); continuation.finish(); return }
                            guard let data = payload.data(using: .utf8),
                                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                            if let error = object["error"] as? String { throw APIError.server(error) }
                            if let delta = object["delta"] as? [String: Any], let text = delta["text"] as? String { continuation.yield(.delta(text)) }
                            if let meta = object["meta"] as? [String: Any], let suggestions = meta["suggestions"] as? [String] { continuation.yield(.meta(suggestions)) }
                        }
                        continuation.yield(.done); continuation.finish(); return
                    }
                } catch is CancellationError {
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func generateReport(input: BirthInput, auth: AuthStore? = nil,
                        progress: @MainActor (GenerationProgress) -> Void = { _ in }) async throws -> GeneratedReport {
        let calendar = Calendar(identifier: .gregorian)
        let parts = calendar.dateComponents([.year, .month, .day], from: input.date)
        let time = input.birthTime.map { calendar.dateComponents([.hour, .minute], from: $0) }
        let date = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
        let birthTime = time.map { String(format: "%02d:%02d", $0.hour!, $0.minute!) } ?? ""
        let birthData: [String: Any] = ["birthDate": date, "birthTime": birthTime, "nickname": input.nickname,
                                        "birthplace": input.birthplace, "gender": input.gender]
        let token: String? = if let auth, auth.session != nil { try await auth.validAccessToken() } else { nil }
        progress(.init(percent: 5, title: "入力内容を確認しています", detail: "生年月日と出生地を確認しています"))
        let calcData = try await data(for: request(path: "/api/calc/divination", method: "POST", token: token, json: birthData), retryTransient: true, auth: auth)
        guard let calculated = try JSONSerialization.jsonObject(with: calcData) as? [String: Any] else { throw APIError.invalidResponse }
        progress(.init(percent: 18, title: "命式を計算しています", detail: "生まれた瞬間の基本データを整えています"))
        let previewBody: [String: Any] = birthData.merging(["question": "", "calculatedData": calculated]) { _, new in new }
        var call = try request(path: "/api/preview/generate?format=sse", method: "POST", token: token, json: previewBody)
        call.timeoutInterval = 120
        let (bytes, response) = try await URLSession.shared.bytes(for: call)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw APIError.invalidResponse }
        var structured: StructuredReportResponse?
        for try await line in bytes.lines {
            guard line.hasPrefix("data: ") else { continue }; let payload = String(line.dropFirst(6)); if payload == "[DONE]" { break }
            guard let data = payload.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            if object["type"] as? String == "progress", let percent = object["percent"] as? Int { progress(.init(percent: percent, title: object["title"] as? String ?? "鑑定書を作っています", detail: object["detail"] as? String ?? "")) }
            if object["type"] as? String == "complete", let report = object["report"], let reportData = try? JSONSerialization.data(withJSONObject: report) { structured = try JSONDecoder().decode(StructuredReportResponse.self, from: reportData) }
            if object["type"] as? String == "error" { throw APIError.server(object["error"] as? String ?? "鑑定書を生成できませんでした") }
        }
        guard let structured else { throw APIError.invalidResponse }
        guard !structured.reportText.isEmpty, !structured.cards.isEmpty else { throw APIError.server("鑑定書を生成できませんでした") }
        return GeneratedReport(birthData: birthData, calculatedData: calculated, text: structured.reportText, cards: structured.cards, chartSections: structured.chartSections ?? [])
    }
}
