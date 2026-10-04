import Foundation

/// Strict PKCE callback parser. Tokens in fragments are never used as sessions.
enum AuthCallback {
    static func code(from url: URL) throws -> String {
        guard url.scheme == "fatelab", url.host == "auth", url.path == "/callback",
              url.user == nil, url.password == nil, url.port == nil else { throw invalid() }
        var values: [String: String] = [:]
        var seen = Set<String>()
        for raw in [url.query, url.fragment].compactMap({ $0 }) {
            var components = URLComponents(); components.percentEncodedQuery = raw
            for item in components.queryItems ?? [] {
                if !seen.insert(item.name).inserted { throw invalid() }
                values[item.name] = item.value ?? ""
            }
        }
        guard values["error"] == nil, values["error_description"] == nil,
              values["error_code"] == nil, values["access_token"] == nil, values["refresh_token"] == nil,
              let code = values["code"], !code.isEmpty, code.count <= 4096,
              URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains(where: { $0.name == "code" }) == true else {
            throw invalid()
        }
        return code
    }
    static func invalid() -> NSError {
        NSError(domain: "FateLabAuthCallback", code: 1, userInfo: [NSLocalizedDescriptionKey:
            "確認リンクが無効か期限切れです。この端末から確認メールを再送してお試しください。"])
    }
}
