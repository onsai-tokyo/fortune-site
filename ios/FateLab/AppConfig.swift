import Foundation

enum AppConfig {
    static let subscriptionProductID = "com.onsai.fatelab.premium.monthly"

    static var apiBaseURL: URL {
        value(named: "APIBaseURL", fallback: "https://fate-lab.com")
    }

    static var supabaseURL: URL {
        value(named: "SupabaseURL", fallback: "https://invalid.supabase.co")
    }

    static var supabaseAnonKey: String {
        Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String ?? ""
    }

    private static func value(named name: String, fallback: String) -> URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: name) as? String ?? fallback
        return URL(string: raw) ?? URL(string: fallback)!
    }
}
