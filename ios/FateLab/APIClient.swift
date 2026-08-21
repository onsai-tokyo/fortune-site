import Foundation
import CryptoKit

enum ReportProgress {
    case calculating
    case integrating
}

enum APIError: LocalizedError {
    case invalidResponse
    case timeout
    case http(status: Int, message: String)
    case paymentRequired(String)
    case rateLimited(String)
    case server(String)
    var errorDescription: String? {
        switch self {
        case .invalidResponse: "読み込めませんでした。通信環境を確認して、もう一度お試しください"
        case .timeout: "45秒以内に応答がありませんでした。時間を置いて再試行してください（タイムアウト）"
        case .http(let status, let message): "\(message)（HTTP \(status)）"
        case .paymentRequired(let message): "\(message)（HTTP 402）"
        case .rateLimited(let message): "\(message)（HTTP 429）"
        case .server(let message): message
        }
    }
}

struct ChatAnswer {
    let text: String
    let suggestions: [String]
}

@MainActor
struct APIClient {
    static let shared = APIClient()
    private init() {}

    private func request(path: String, method: String = "GET", token: String? = nil, json: Any? = nil) throws -> URLRequest {
        // `appending(path:)` は `?v=2` までパスとして扱い、`%3Fv=2` に
        // エンコードしてしまう。相対URLとして解決し、クエリを保持する。
        guard let url = URL(string: path, relativeTo: AppConfig.apiBaseURL)?.absoluteURL else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        // Render のコールドスタート後に占術計算が60秒を少し超える場合がある。
        // URLSession の既定値（60秒）で正常な鑑定を失敗扱いにしない。
        request.timeoutInterval = 40
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
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
                let error: APIError = switch http.statusCode {
                case 402: .paymentRequired(message)
                case 429: .rateLimited("アクセスが集中しています。少し待ってから、もう一度お試しください")
                default: .http(status: http.statusCode, message: message)
                }
                lastError = error
                let transientStatusCodes = [500, 502, 503, 504]
                if retryTransient, attempt + 1 < maximumAttempts, transientStatusCodes.contains(http.statusCode) {
                    let delay = 2 * (attempt + 1)
                    guard ContinuousClock.now.advanced(by: .seconds(delay)) < deadline else { throw APIError.timeout }
                    try await Task.sleep(for: .seconds(delay))
                    continue
                }
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
                throw normalizedError
            }
        }
        throw lastError
    }

    func warmup() async {
        guard let call = try? request(path: "/health") else { return }
        _ = try? await data(for: call, retryTransient: true)
    }

    func status(auth: AuthStore) async throws -> ReadingStatus {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/status", token: token), auth: auth)
        return try JSONDecoder().decode(ReadingStatus.self, from: raw)
    }

    func readings(auth: AuthStore) async throws -> [ReadingSummary] {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/conversations", token: token), auth: auth)
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["conversations"] ?? [])
        return try JSONDecoder().decode([ReadingSummary].self, from: list)
    }

    func traits(auth: AuthStore) async throws -> [ProfileTrait] {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/profile/traits", token: token), auth: auth)
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
        let raw = try await data(for: request(path: "/api/partners", token: token), auth: auth)
        return try JSONDecoder().decode(PartnerProfilesResponse.self, from: raw)
    }

    func createPartner(displayName: String, birthDate: String, birthTime: String?, birthplace: String,
                       gender: String, relationshipType: String, auth: AuthStore) async throws -> PartnerProfile {
        let token = try await auth.validAccessToken()
        var body: [String: Any] = ["displayName": displayName, "birthDate": birthDate, "birthplace": birthplace,
                                   "gender": gender, "relationshipType": relationshipType]
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

    func compatibility(partnerID: UUID, relationshipType: String, auth: AuthStore) async throws -> StructuredReportResponse {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/partners/\(partnerID.uuidString)/compatibility", method: "POST",
                                               token: token, json: ["relationshipType": relationshipType]), retryTransient: true, auth: auth)
        return try JSONDecoder().decode(StructuredReportResponse.self, from: raw)
    }

    func verifyApplePurchase(signedTransaction: String, auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/apple/transactions/verify", method: "POST", token: token,
                                        json: ["signedTransaction": signedTransaction]), auth: auth)
    }

    func deleteAccount(auth: AuthStore) async throws {
        let token = try await auth.validAccessToken()
        _ = try await data(for: request(path: "/api/reading/account", method: "DELETE", token: token), auth: auth)
    }

    func createConversation(report: GeneratedReport, auth: AuthStore) async throws -> UUID {
        let token = try await auth.validAccessToken()
        let source = String(describing: report.birthData) + report.text
        let key = SHA256.hash(data: Data(source.utf8)).map { String(format: "%02x", $0) }.joined()
        var call = try request(path: "/api/reading/conversations", method: "POST", token: token, json: [
            "title": "命式鑑定書",
            "birthData": report.birthData,
            "calculatedData": report.calculatedData,
            "reportText": report.text,
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
        let raw = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)", token: token), auth: auth)
        return try JSONDecoder().decode(ConversationDetail.self, from: raw)
    }

    func cards(id: UUID, auth: AuthStore) async throws -> StructuredReportResponse {
        let token = try await auth.validAccessToken()
        let raw = try await data(for: request(path: "/api/reading/\(id.uuidString)/cards", token: token), auth: auth)
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

    func generateReport(input: BirthInput, auth: AuthStore? = nil,
                        progress: @MainActor (ReportProgress) -> Void = { _ in }) async throws -> GeneratedReport {
        let calendar = Calendar(identifier: .gregorian)
        let parts = calendar.dateComponents([.year, .month, .day], from: input.date)
        let time = calendar.dateComponents([.hour, .minute], from: input.time)
        let date = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
        let birthTime = input.hasTime ? String(format: "%02d:%02d", time.hour!, time.minute!) : ""
        let birthData: [String: Any] = ["birthDate": date, "birthTime": birthTime,
                                        "birthplace": input.birthplace, "gender": input.gender]
        let token: String? = if let auth, auth.session != nil { try await auth.validAccessToken() } else { nil }
        progress(.calculating)
        let calcData = try await data(for: request(path: "/api/calc/divination", method: "POST", token: token, json: birthData), retryTransient: true, auth: auth)
        guard let calculated = try JSONSerialization.jsonObject(with: calcData) as? [String: Any] else { throw APIError.invalidResponse }
        progress(.integrating)
        let previewBody: [String: Any] = birthData.merging(["question": "", "calculatedData": calculated]) { _, new in new }
        let raw = try await data(for: request(path: "/api/preview/generate?format=json", method: "POST", token: token, json: previewBody), retryTransient: true, auth: auth)
        let structured = try JSONDecoder().decode(StructuredReportResponse.self, from: raw)
        guard !structured.reportText.isEmpty, !structured.cards.isEmpty else { throw APIError.server("鑑定書を生成できませんでした") }
        return GeneratedReport(birthData: birthData, calculatedData: calculated, text: structured.reportText, cards: structured.cards)
    }
}
