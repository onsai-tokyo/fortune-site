import Foundation

/// Identity of an operation, including logout and login to the same user.
struct AccountScope: Hashable {
    let userID: UUID?
    let epoch: UInt64

    init(userID: UUID?, epoch: UInt64) { self.userID = userID; self.epoch = epoch }

    @MainActor init(_ auth: AuthStore?) {
        userID = auth?.userID
        epoch = auth?.authEpoch ?? 0
    }
    @MainActor func isCurrent(_ auth: AuthStore?) -> Bool { self == AccountScope(auth) }
    @MainActor func check(_ auth: AuthStore?) throws {
        try Task.checkCancellation()
        guard isCurrent(auth) else { throw CancellationError() }
    }
}

enum AccountStorage {
    static func key(_ name: String, userID: UUID?) -> String {
        (AppConfig.internalCheck ? "authcheck." : "") + "fatelab.account.\(userID?.uuidString.lowercased() ?? "guest").\(name)"
    }
    static func birthProfile(userID: UUID?, defaults: UserDefaults = .standard) -> BirthInput? {
        guard userID != nil else { return nil }
        for name in ["birth.profile", "reading.draft"] {
            if let data = defaults.data(forKey: key(name, userID: userID)),
               let input = try? JSONDecoder().decode(BirthInput.self, from: data) { return input }
        }
        if let encoded = defaults.string(forKey: key("onboarding.draft", userID: userID)),
           let data = Data(base64Encoded: encoded) {
            return try? JSONDecoder().decode(BirthInput.self, from: data)
        }
        return nil
    }
    // Legacy values without a proven owner remain untouched and are never shown
    // to a newly signed-in account.
}

extension String { var nilIfEmpty: String? { isEmpty ? nil : self } }
