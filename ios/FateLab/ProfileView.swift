import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input = BirthInput()
    @State private var saved = false
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                FateEditorialHero(eyebrow: "YOUR PROFILE", title: "あなたのプロフィール", subtitle: "あなたを読み解く、生まれたときの情報。")
                Text("次に作る鑑定と、あなたの年表の読み解きに使います。保存済み鑑定の「今の状況」は作成時の設定を使います。")
                    .foregroundStyle(FateTheme.muted).lineSpacing(5)
                TextField("呼び名", text: $input.nickname, prompt: Text("呼び名").foregroundStyle(FateTheme.muted))
                    .fateInput().accessibilityLabel("呼び名")
                BirthProfileFields(date: $input.date, birthTime: $input.birthTime,
                                   birthplace: $input.birthplace, gender: $input.gender)
                    .padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
                RelationshipStatusFields(value: $input.relationshipStatus)
                if let errorMessage { Text(errorMessage).foregroundStyle(FateTheme.danger) }
                if saved { Text("プロフィールを保存しました。次の新規鑑定から使えます。")
                    .foregroundStyle(FateTheme.ink).accessibilityIdentifier("profile.saved") }
                Button(saving ? "保存しています" : "プロフィールを保存") { Task { await save() } }
                    .buttonStyle(FLPrimaryButtonStyle()).disabled(auth.userID == nil || saving)
            }.padding(FateSpacing.screenH)
        }
        .background(FateTheme.canvas).fateScreenTitle("プロフィール")
        .task(id: AccountScope(auth)) { restore(); await restoreServer() }
        .onChange(of: input) { _, _ in saved = false }
    }

    private func key(_ name: String) -> String { AccountStorage.key(name, userID: auth.userID) }

    private func restore() {
        saved = false
        errorMessage = nil
        input = BirthInput()
        let defaults = UserDefaults.standard
        if let data = defaults.data(forKey: key("birth.profile")) ?? defaults.data(forKey: key("reading.draft")),
           let value = try? JSONDecoder().decode(BirthInput.self, from: data) { input = value }
        else if let encoded = defaults.string(forKey: key("onboarding.draft")),
                let data = Data(base64Encoded: encoded),
                let value = try? JSONDecoder().decode(BirthInput.self, from: data) { input = value }
    }

    private func restoreServer() async {
        let owner = AccountScope(auth)
        let initial = input
        do {
            let response = try await APIClient.shared.timelineCall(TimelineProfileResponse.self, path: "/profile", auth: auth)
            try owner.check(auth)
            guard input == initial, let profile = response.profile else { return }
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            guard let date = formatter.date(from: profile.birthDate) else { return }
            input.date = date
            formatter.dateFormat = "HH:mm"
            input.birthTime = profile.birthTime.flatMap { formatter.date(from: $0) }
            input.birthplace = profile.birthplace ?? input.birthplace
            input.gender = profile.gender ?? input.gender
            input.relationshipStatus = profile.relationshipStatus
        } catch { if owner.isCurrent(auth) { errorMessage = userFacingErrorMessage(error) } }
    }

    private func save() async {
        let owner = AccountScope(auth)
        saving = true
        defer { saving = false }
        guard auth.userID != nil else { return }
        do {
            _ = try await APIClient.shared.timelineCall(TimelineProfileResponse.self, path: "/profile", method: "PUT", json: input.timelineJSON, auth: auth)
            try owner.check(auth)
            let data = try JSONEncoder().encode(input)
            let defaults = UserDefaults.standard
            defaults.set(data, forKey: key("birth.profile"))
            defaults.set(data, forKey: key("reading.draft"))
            defaults.set(data.base64EncodedString(), forKey: key("onboarding.draft"))
            defaults.set(1, forKey: key("onboarding.step"))
            saved = true
            errorMessage = nil
        } catch { errorMessage = userFacingErrorMessage(error) }
    }
}


struct AnnualContextFields: View {
    @Binding var input: BirthInput
    private func selection(_ key: WritableKeyPath<BirthInput, String?>) -> Binding<String> {
        Binding(get: { input[keyPath: key] ?? "unknown" }, set: { input[keyPath: key] = $0 == "unknown" ? nil : $0 })
    }
    var body: some View {
        DisclosureGroup("年間鑑定の設定（任意）") {
            VStack(alignment: .leading, spacing: 16) {
                Text("未選択でも年間の本文を読めます。候補ラベルに必要な計算区分は、ご自身で選択できます。性別の入力から自動選択はしません。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
                Picker("長期的な流れの計算", selection: selection(\.annualYunConvention)) {
                    Text("未選択").tag("unknown")
                    Text("伝統的な女性区分").tag("female")
                    Text("伝統的な男性区分").tag("male")
                }
                Picker("婚期候補の計算", selection: selection(\.spouseConvention)) {
                    Text("未選択").tag("unknown")
                    Text("伝統的な女性区分").tag("female_officer")
                    Text("伝統的な男性区分").tag("male_wealth")
                }
                Text("これらは占術上の計算方法を選ぶ項目です。性自認や交際相手の性別を表すものではありません。出生時刻が不明の場合、長期的な流れを使う判定には保留が残ります。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
                Picker("仕事・活動の状況", selection: selection(\.workContext)) {
                    Text("未選択・その他").tag("unknown")
                    Text("勤務している").tag("employed")
                    Text("自営・フリーランス").tag("independent")
                    Text("学生").tag("student")
                }
                Text("候補の表示名に使います。過去の年に表示される名称も、この鑑定を作る際の設定に基づきます。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
            }.padding(.top, 12).pickerStyle(.menu)
        }.foregroundStyle(FateTheme.ink)
    }
}
