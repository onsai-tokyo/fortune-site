import SwiftUI

struct TimelineV3DisplayMetadata: Codable { let version: String }
struct TimelineProfileResponse: Decodable { let profile: TimelineBirthProfile? }
struct TimelineBirthProfile: Decodable {
    let birthDate: String
    let birthTime: String?
    let birthplace: String?
    let gender: String?
    let relationshipStatus: String?
}
struct LifeEvent: Codable, Hashable, Identifiable {
    var year: Int
    var month: Int?
    var kind: String
    var id: String { "\(year)|\(month ?? 0)|\(kind)" }
    static let kinds = [("encounter", "出会い"), ("start", "交際の始まり"), ("reunion", "復縁"), ("marriage", "結婚・入籍"), ("breakup", "別れ"), ("divorce", "離婚"), ("job", "仕事の変化"), ("study", "進学・卒業"), ("move", "引っ越し"), ("other", "大切な出来事")]
    var label: String { Self.kinds.first { $0.0 == kind }?.1 ?? kind }
}
struct LifeEventsResponse: Decodable { let events: [LifeEvent] }
struct EventReadingsResponse: Decodable { let readings: [LifeEventReading] }
struct LifeEventReading: Decodable, Identifiable {
    let id: String
    let year: Int
    let title: String
    let sections: [ReadingCardSection]
}
struct TimelineConsentResponse: Decodable { let consented: Bool }

extension BirthInput {
    var timelineJSON: [String: Any] {
        let calendar = Calendar(identifier: .gregorian)
        let day = calendar.dateComponents([.year, .month, .day], from: date)
        let time = birthTime.map { calendar.dateComponents([.hour, .minute], from: $0) }
        return ["birthDate": String(format: "%04d-%02d-%02d", day.year!, day.month!, day.day!),
                "birthTime": time.map { String(format: "%02d:%02d", $0.hour!, $0.minute!) } ?? "",
                "birthplace": birthplace, "gender": gender,
                "relationshipStatus": relationshipStatus as Any? ?? NSNull(), "workContext": workContext as Any? ?? NSNull()]
    }
}

struct RelationshipStatusFields: View {
    @Binding var value: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("今の状況（任意）", selection: Binding(get: { value ?? "" }, set: { value = $0.isEmpty ? nil : $0 })) {
                Text("答えない").tag("")
                Text("交際中").tag("partnered")
                Text("相手はいない").tag("single")
                Text("既婚").tag("married")
            }.tint(FateTheme.ink)
            Text("時系列の文章と、関係の時期の判定に使います。").font(.footnote).foregroundStyle(FateTheme.muted)
        }.padding(18).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 18))
    }
}

struct LifeEventsEditorView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    var onSaved: () -> Void = {}
    @State private var events: [LifeEvent] = []
    @State private var year = Calendar.current.component(.year, from: Date())
    @State private var month = 0
    @State private var kind = "encounter"
    @State private var birthYear = 1900
    @State private var loading = true
    @State private var working = false
    @State private var error: String?
    @State private var ready = false
    private var currentYear: Int { Calendar.current.component(.year, from: Date()) }
    var body: some View {
        Form {
            Section {
                Text("あなたの出来事を、年ごとの読み解きにつなげます。種類・年・月だけを記録します。入力内容はあなたの読み解きに使い、検証への利用は設定で別に同意した場合だけです。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
            }
            if loading { ProgressView("年表を開いています") }
            if let error {
                Section { Text(error).foregroundStyle(FateTheme.danger); Button("もう一度確認") { Task { await load() } }; NavigationLink("プロフィールを確認する") { ProfileView() } }
            }
            if ready {
                Section("出来事を追加") {
                    Picker("年", selection: $year) { ForEach(Array((birthYear...currentYear).reversed()), id: \.self) { Text("\(String($0))年").tag($0) } }
                    Picker("月（任意）", selection: $month) { Text("未入力").tag(0); ForEach(1...12, id: \.self) { Text("\($0)月").tag($0) } }
                    Picker("出来事", selection: $kind) { ForEach(LifeEvent.kinds, id: \.0) { Text($0.1).tag($0.0) } }
                    Button("年表に追加") {
                        let event = LifeEvent(year: year, month: month == 0 ? nil : month, kind: kind)
                        if !events.contains(event) { events.append(event); events.sort { $0.year < $1.year } }
                    }.disabled(events.count >= 100)
                }
                Section("あなたの年表") {
                    if events.isEmpty { Text("まだ出来事はありません").foregroundStyle(FateTheme.muted) }
                    ForEach(events) { event in
                        HStack { Text("\(String(event.year))年" + (event.month.map { "\($0)月" } ?? "")); Text(event.label); Spacer(); Button(role: .destructive) { events.removeAll { $0.id == event.id } } label: { Image(systemName: "minus.circle") }.accessibilityLabel("\(event.year)年の\(event.label)を削除") }
                    }
                }
                Section { Button(working ? "保存しています" : "年表を保存") { Task { await save() } }.disabled(working) }
            }
        }.scrollContentBackground(.hidden).background(FateTheme.canvas)
            .navigationTitle("あなたの年表").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() }.disabled(working) } }
            .task(id: AccountScope(auth)) { await load() }
    }
    private func load() async {
        let owner = AccountScope(auth)
        loading = true; ready = false; error = nil
        defer { loading = false }
        do {
            var profile = try await APIClient.shared.timelineCall(TimelineProfileResponse.self, path: "/profile", auth: auth)
            if profile.profile == nil {
                let defaults = UserDefaults.standard
                if let bytes = defaults.data(forKey: AccountStorage.key("birth.profile", userID: auth.userID)), let input = try? JSONDecoder().decode(BirthInput.self, from: bytes) {
                    profile = try await APIClient.shared.timelineCall(TimelineProfileResponse.self, path: "/profile", method: "PUT", json: input.timelineJSON, auth: auth)
                }
            }
            guard let value = profile.profile, let start = Int(value.birthDate.prefix(4)), start <= currentYear else { throw APIError.server("プロフィールを保存してから年表を登録してください。") }
            let result = try await APIClient.shared.timelineCall(LifeEventsResponse.self, path: "/events", auth: auth)
            try owner.check(auth)
            birthYear = max(1900, start); events = result.events; ready = true
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
    private func save() async {
        let owner = AccountScope(auth); working = true; error = nil
        defer { working = false }
        do {
            let array = try JSONSerialization.jsonObject(with: JSONEncoder().encode(events))
            _ = try await APIClient.shared.timelineCall(LifeEventsResponse.self, path: "/events", method: "POST", json: ["events": array], auth: auth)
            try owner.check(auth); onSaved(); dismiss()
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

struct TimelineConsentView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var consented = false
    @State private var loaded = false
    @State private var working = false
    @State private var error: String?
    var body: some View {
        Form {
            Section {
                Text("読み解きの改善への協力は任意です。同意しなくても、年表と鑑定を使えます。")
                Text("同意すると、生年月日・出生時刻・都道府県・性別と、出来事の種類・年月を検証に利用できます。名前・メールアドレス・アカウントIDは検証用の出力に含めません。ただし、出生情報などの組み合わせから個人が推測される可能性はあります。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
                Toggle("読み解きの精度向上に協力する", isOn: Binding(get: { consented }, set: { value in Task { await save(value) } })).disabled(!loaded || working)
                Text("初期設定はオフです。いつでも取り消せます。取り消した後は新たな検証用出力に含めません。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
                if working { ProgressView() }
                if let error { Text(error).foregroundStyle(FateTheme.danger); Button("再読み込み") { Task { await load() } } }
            }
        }.scrollContentBackground(.hidden).background(FateTheme.canvas).tint(FateTheme.ink).fateScreenTitle("精度向上への協力").task(id: AccountScope(auth)) { await load() }
    }
    private func load() async {
        do { consented = try await APIClient.shared.timelineCall(TimelineConsentResponse.self, path: "/consent", auth: auth).consented; loaded = true; error = nil }
        catch { self.error = userFacingErrorMessage(error) }
    }
    private func save(_ value: Bool) async {
        working = true; error = nil; defer { working = false }
        do { consented = try await APIClient.shared.timelineCall(TimelineConsentResponse.self, path: "/consent", method: "PUT", json: ["consented": value], auth: auth).consented }
        catch { self.error = userFacingErrorMessage(error) }
    }
}

struct EventReadingView: View {
    let reading: LifeEventReading
    var body: some View {
        DisclosureGroup(reading.title) {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(reading.sections) { section in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(section.heading).font(.subheadline.weight(.medium))
                        Text(section.body).font(.body).lineSpacing(7).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }.padding(.top, 16)
        }.tint(FateTheme.ink).padding(18).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

// Enrollment is retired; existing participants retain withdrawal access.
struct TimelineConsentWithdrawalView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var consented = false
    @State private var working = false
    @State private var error: String?
    var body: some View {
        Group {
            if consented {
                Button("検証へのデータ利用を停止する") { Task { await update(withdraw: true) } }.disabled(working)
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(FateTheme.muted)
                Button("データ利用設定を再確認") { Task { await update() } }.disabled(working)
            }
        }.task(id: AccountScope(auth)) { consented = false; await update() }
    }
    private func update(withdraw: Bool = false) async {
        let owner = AccountScope(auth)
        guard owner.userID != nil else { return }
        working = true
        defer { if owner.isCurrent(auth) { working = false } }
        do {
            let result = try await APIClient.shared.timelineCall(TimelineConsentResponse.self, path: "/consent", method: withdraw ? "PUT" : "GET", json: withdraw ? ["consented": false] : nil, auth: auth)
            try owner.check(auth)
            consented = result.consented; error = nil
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}
