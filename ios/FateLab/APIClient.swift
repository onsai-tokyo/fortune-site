import Foundation
import CryptoKit

enum ReportProgress {
    case calculating
    case integrating
}

enum APIError: LocalizedError {
    case invalidResponse
    case server(String)
    var errorDescription: String? {
        switch self { case .invalidResponse: "サーバーへ接続できませんでした"; case .server(let message): message }
    }
}

@MainActor
struct APIClient {
    static let shared = APIClient()
    private init() {}

    private func request(path: String, method: String = "GET", token: String? = nil, json: Any? = nil) throws -> URLRequest {
        var request = URLRequest(url: AppConfig.apiBaseURL.appending(path: path))
        // Render のコールドスタート後に占術計算が60秒を少し超える場合がある。
        // URLSession の既定値（60秒）で正常な鑑定を失敗扱いにしない。
        request.timeoutInterval = 180
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let json { request.httpBody = try JSONSerialization.data(withJSONObject: json) }
        return request
    }

    private func data(for request: URLRequest, retryTransient: Bool = false) async throws -> Data {
        let maximumAttempts = retryTransient ? 3 : 1
        var lastError: Error = APIError.invalidResponse

        for attempt in 0..<maximumAttempts {
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
                if 200..<300 ~= http.statusCode { return data }

                let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                let error = APIError.server(object?["error"] as? String ?? "一時的に接続できませんでした。もう一度お試しください")
                lastError = error
                let transientStatusCodes = [500, 502, 503, 504]
                if retryTransient, attempt + 1 < maximumAttempts, transientStatusCodes.contains(http.statusCode) {
                    try await Task.sleep(for: .seconds(2 * (attempt + 1)))
                    continue
                }
                throw error
            } catch {
                lastError = error
                let transientCodes: Set<URLError.Code> = [
                    .timedOut, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
                    .networkConnectionLost, .notConnectedToInternet,
                ]
                if retryTransient, attempt + 1 < maximumAttempts,
                   let urlError = error as? URLError, transientCodes.contains(urlError.code) {
                    try await Task.sleep(for: .seconds(2 * (attempt + 1)))
                    continue
                }
                throw error
            }
        }
        throw lastError
    }

    func warmup() async {
        guard let call = try? request(path: "/health") else { return }
        _ = try? await data(for: call, retryTransient: true)
    }

    func status(token: String) async throws -> ReadingStatus {
        let raw = try await data(for: request(path: "/api/reading/status", token: token))
        return try JSONDecoder().decode(ReadingStatus.self, from: raw)
    }

    func readings(token: String) async throws -> [ReadingSummary] {
        let raw = try await data(for: request(path: "/api/reading/conversations", token: token))
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["conversations"] ?? [])
        return try JSONDecoder().decode([ReadingSummary].self, from: list)
    }

    func traits(token: String) async throws -> [ProfileTrait] {
        let raw = try await data(for: request(path: "/api/reading/profile/traits", token: token))
        let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
        let list = try JSONSerialization.data(withJSONObject: object?["traits"] ?? [])
        return try JSONDecoder().decode([ProfileTrait].self, from: list)
    }

    func deleteTrait(id: UUID, token: String) async throws {
        _ = try await data(for: request(path: "/api/reading/profile/traits/\(id.uuidString)", method: "DELETE", token: token))
    }

    func verifyApplePurchase(signedTransaction: String, token: String) async throws {
        _ = try await data(for: request(path: "/api/apple/transactions/verify", method: "POST", token: token,
                                        json: ["signedTransaction": signedTransaction]))
    }

    func deleteAccount(token: String) async throws {
        _ = try await data(for: request(path: "/api/reading/account", method: "DELETE", token: token))
    }

    func createConversation(report: GeneratedReport, token: String) async throws -> UUID {
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
        let raw = try await data(for: call)
        guard let object = try JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let id = object["id"] as? String, let uuid = UUID(uuidString: id) else { throw APIError.invalidResponse }
        return uuid
    }

    func conversation(id: UUID, token: String) async throws -> ConversationDetail {
        let raw = try await data(for: request(path: "/api/reading/conversations/\(id.uuidString)", token: token))
        return try JSONDecoder().decode(ConversationDetail.self, from: raw)
    }

    func ask(conversationID: UUID, question: String, token: String) async throws -> String {
        let raw = try await data(for: request(path: "/api/reading/conversations/\(conversationID.uuidString)/questions",
                                               method: "POST", token: token, json: ["question": question]))
        let text = String(decoding: raw, as: UTF8.self).split(separator: "\n").reduce(into: "") { result, line in
            guard line.hasPrefix("data: ") else { return }
            let payload = String(line.dropFirst(6))
            guard payload != "[DONE]", let chunk = payload.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: chunk) as? [String: Any],
                  let delta = object["delta"] as? [String: Any], let part = delta["text"] as? String else { return }
            result += part
        }
        guard !text.isEmpty else { throw APIError.server("回答を取得できませんでした") }
        return text
    }

    func generateReport(input: BirthInput, progress: @MainActor (ReportProgress) -> Void = { _ in }) async throws -> GeneratedReport {
        let calendar = Calendar(identifier: .gregorian)
        let parts = calendar.dateComponents([.year, .month, .day], from: input.date)
        let time = calendar.dateComponents([.hour, .minute], from: input.time)
        let date = String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
        let birthTime = input.hasTime ? String(format: "%02d:%02d", time.hour!, time.minute!) : ""
        let birthData: [String: Any] = ["birthDate": date, "birthTime": birthTime,
                                        "birthplace": input.birthplace, "gender": input.gender]
        progress(.calculating)
        let calcData = try await data(for: request(path: "/api/calc/divination", method: "POST", json: birthData), retryTransient: true)
        guard let calculated = try JSONSerialization.jsonObject(with: calcData) as? [String: Any] else { throw APIError.invalidResponse }
        progress(.integrating)
        let previewBody: [String: Any] = birthData.merging(["question": "", "calculatedData": calculated]) { _, new in new }
        let stream = try await data(for: request(path: "/api/preview/generate?v=2", method: "POST", json: previewBody), retryTransient: true)
        let text = String(decoding: stream, as: UTF8.self).split(separator: "\n").reduce(into: "") { result, line in
            guard line.hasPrefix("data: ") else { return }
            let payload = String(line.dropFirst(6))
            guard payload != "[DONE]", let data = payload.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let delta = object["delta"] as? [String: Any], let part = delta["text"] as? String else { return }
            result += part
        }
        guard !text.isEmpty else { throw APIError.server("鑑定書を生成できませんでした") }
        return GeneratedReport(birthData: birthData, calculatedData: calculated, text: text)
    }
}
