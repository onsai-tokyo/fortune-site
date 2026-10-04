import Foundation
import Security
import Supabase

/// Keep the SDK's existing Keychain namespace and accessibility, but implement
/// AuthLocalStorage's optional-read / idempotent-remove contract explicitly.
/// Supabase 2.55.1's default Keychain store throws even for errSecItemNotFound.
struct AuthKeychainStorage: AuthLocalStorage {
    private let service: String

    init(service: String = "supabase.gotrue.swift") { self.service = service }

    private func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: key]
    }

    func retrieve(key: String) throws -> Data? {
        var request = query(key)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
        guard let data = value as? Data else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(errSecDecode)) }
        return data
    }

    func store(key: String, value: Data) throws {
        var item = query(key)
        item[kSecValueData as String] = value
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(item as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let updated = SecItemUpdate(query(key) as CFDictionary, [kSecValueData as String: value] as CFDictionary)
            guard updated == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(updated)) }
        } else if status != errSecSuccess {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    func remove(key: String) throws {
        let status = SecItemDelete(query(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }
}

/// SDK storage is the sole token owner. A retired SDK instance cannot write after logout.
final class AuthSessionStorage: AuthLocalStorage, @unchecked Sendable {
    private let lock = NSLock()
    private var retired = false
    private var retiredSession: (String, Data)?
    private var failure: Error?
    private let base: any AuthLocalStorage
    init(base: any AuthLocalStorage = AuthKeychainStorage()) { self.base = base }
    func store(key: String, value: Data) throws {
        try lock.withLock {
            guard !retired else { throw CancellationError() }
            do { try base.store(key: key, value: value) }
            catch { failure = error; throw error }
        }
    }
    func retrieve(key: String) throws -> Data? {
        try lock.withLock {
            guard !retired else { return retiredSession?.0 == key ? retiredSession?.1 : nil }
            do { return try base.retrieve(key: key) }
            catch { failure = error; throw error }
        }
    }
    func remove(key: String) throws {
        try lock.withLock {
            guard !retired else { return }
            do { try base.remove(key: key) }
            catch { failure = error; throw error }
        }
    }
    func check() throws { try lock.withLock { if retired { throw CancellationError() }; if let failure { throw failure } } }
    func retire(removing key: String) throws {
        try lock.withLock {
            let wasRetired = retired
            retired = true
            if !wasRetired, let data = try base.retrieve(key: key) { retiredSession = (key, data) }
            try base.remove(key: key)
            try base.remove(key: key + "-code-verifier")
            try base.remove(key: key + "-legacy-primary-migrated")
        }
    }
}

@MainActor
final class AuthSessionAdapter {
    static var storageKey: String { (AppConfig.internalCheck ? "authcheck-" : "") + "sb-\(AppConfig.supabaseURL.host!.split(separator: ".")[0])-auth-token" }
    static var legacyMigrationKey: String { storageKey + "-legacy-primary-migrated" }
    let storage: AuthSessionStorage
    let client: SupabaseClient
    init(storage: AuthSessionStorage = AuthSessionStorage(), client: SupabaseClient? = nil) {
        self.storage = storage
        self.client = client ?? SupabaseClient(supabaseURL: AppConfig.supabaseURL, supabaseKey: AppConfig.supabaseAnonKey,
            options: .init(auth: .init(storage: storage, storageKey: Self.storageKey,
                flowType: .pkce, autoRefreshToken: false, emitLocalSessionAsInitialSession: true)))
    }
    func checked(_ value: Supabase.Session) throws -> Session {
        try storage.check()
        guard client.auth.currentSession?.accessToken == value.accessToken else {
            throw NSError(domain: "FateLabAuthStorage", code: 1)
        }
        return Session(accessToken: value.accessToken, refreshToken: value.refreshToken,
                       expiresAt: value.expiresAt, user: AppUser(id: value.user.id, email: value.user.email))
    }
}
