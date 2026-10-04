import Foundation

enum AppConfig {
    static var basicFlowCheck: Bool {
#if FATELAB_FLOW_CHECK
        true
#else
        false
#endif
    }

    // Both internal builds keep the login established in build63 and remain
    // separate from the normal app's session, drafts and pending operations.
    static var internalCheck: Bool { authenticationCheckOnly || basicFlowCheck }
    static var storeKitEnabled: Bool { !authenticationCheckOnly }
    static let purchasesUnavailableMessage = "この確認版では購入・復元は利用できません。"

    static func requireStoreKit() throws {
        guard storeKitEnabled else {
            throw NSError(domain: "FateLabPurchaseUnavailable", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: purchasesUnavailableMessage])
        }
    }

    // Dedicated build configuration; not remotely switchable or a premium bypass.
    static var authenticationCheckOnly: Bool {
#if FATELAB_AUTH_CHECK
        true
#else
        false
#endif
    }

    static func requireApplicationAPI(authCheckOnly: Bool = authenticationCheckOnly) throws {
        guard !authCheckOnly else {
            throw NSError(domain: "FateLabAuthCheck", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "このビルドはログイン確認専用です。鑑定・登録・購入は利用できません。"])
        }
    }

    static let bookProductID = "com.onsai.fatelab.report.single"
    static let subscriptionProductID = "com.onsai.fatelab.premium.monthly"

    static var apiBaseURL: URL {
        configuredURL(named: "APIBaseURL") ?? URL(string: "https://invalid.invalid")!
    }

    static let websiteBaseURL = URL(string: "https://fate-lab.com")!

    static var supabaseURL: URL {
        configuredURL(named: "SupabaseURL") ?? URL(string: "https://invalid.supabase.co")!
    }

    static var supabaseAnonKey: String {
        Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String ?? ""
    }

    static var authenticationConfigurationIsValid: Bool {
        configuredURL(named: "SupabaseURL") != nil && !supabaseAnonKey.isEmpty && !supabaseAnonKey.contains("$(")
    }

    static var requiresAuthentication: Bool {
        Bundle.main.object(forInfoDictionaryKey: "RequireAuthentication") as? Bool ?? true
    }

    // Missing or malformed configuration must never select another deployment.
    static func endpoint(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty, raw == raw.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.contains("$("), let url = URL(string: raw),
              url.scheme == "https", let host = url.host, !host.isEmpty,
              host != "invalid.supabase.co", host != "invalid.invalid", !host.hasSuffix(".invalid"),
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { return nil }
        return url
    }

    private static func configuredURL(named name: String) -> URL? {
        endpoint(Bundle.main.object(forInfoDictionaryKey: name) as? String)
    }

    static func requireAPIBaseURL() throws -> URL {
        guard let url = configuredURL(named: "APIBaseURL") else {
            throw NSError(domain: "FateLabConfiguration", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "接続先の設定が不正です。開発者にビルドの確認を依頼してください。"])
        }
        return url
    }
}
