import SwiftUI

struct PartnerProfilesView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var partners: [PartnerProfile] = []
    @State private var selected: PartnerProfile?
    @State private var remaining = 2
    @State private var showPicker = false
    @State private var showRegistration = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("あの人とについて").font(.system(size: 30, weight: .medium, design: .serif))
                Text("二人のプロフィールを重ねて、関係の中で表れやすい力を読みます。")
                    .foregroundStyle(FateTheme.muted)
                ReportCard {
                    HStack(spacing: 16) {
                        profileTile(title: "あなた", subtitle: auth.session?.user.email ?? "登録済み", icon: "person.crop.circle")
                        Text("&").font(.title2).foregroundStyle(FateTheme.gold)
                        Button { showPicker = true } label: {
                            profileTile(title: selected?.displayName ?? "相手を選ぶ",
                                        subtitle: selected.map(typeLabel) ?? "未設定", icon: "person.crop.circle.badge.plus")
                        }.buttonStyle(.plain)
                    }
                }
                Picker("関係性", selection: Binding(get: { selected?.relationshipType ?? "romantic" }, set: { _ in })) {
                    Text("恋愛").tag("romantic"); Text("友人").tag("friend")
                }.pickerStyle(.segmented).disabled(selected == nil)
                if selected == nil {
                    Text("先に相手を登録または選択してください。")
                        .font(.callout).foregroundStyle(FateTheme.muted)
                }
                Button("相性・関係性の鑑定結果へ進む") { }
                    .buttonStyle(GoldButtonStyle()).disabled(selected == nil).opacity(selected == nil ? 0.45 : 1)
                Text("残り\(remaining)人まで登録できます").font(.caption).foregroundStyle(FateTheme.muted)
                if let errorMessage { Text(errorMessage).foregroundStyle(.red).font(.caption) }
            }.padding(20)
        }
        .background(FateTheme.ivory).navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $showPicker) { pickerSheet }
        .sheet(isPresented: $showRegistration) { PartnerRegistrationView { await load(selectNewest: true) } }
    }

    private func profileTile(title: String, subtitle: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 34)).foregroundStyle(FateTheme.gold)
            Text(title).font(.headline).foregroundStyle(FateTheme.ink)
            Text(subtitle).font(.caption).foregroundStyle(FateTheme.muted).lineLimit(1)
            Image(systemName: "chevron.down").font(.caption).foregroundStyle(FateTheme.gold)
        }.frame(maxWidth: .infinity).padding(.vertical, 12)
    }

    private var pickerSheet: some View {
        NavigationStack {
            List {
                Section {
                    Button("新しく相手を登録する") {
                        if remaining > 0 { showPicker = false; showRegistration = true }
                        else { errorMessage = "2人登録済みです。既存の相手を削除してから登録してください。" }
                    }.disabled(remaining == 0)
                } footer: { Text(remaining == 0 ? "上限に達しています。行を左へスワイプして削除できます。" : "残り\(remaining)人まで登録できます") }
                Section("登録済みの相手") {
                    ForEach(partners) { partner in
                        Button { selected = partner; showPicker = false } label: {
                            HStack {
                                Image(systemName: "person.crop.circle").foregroundStyle(FateTheme.gold)
                                VStack(alignment: .leading) { Text(partner.displayName); Text(typeLabel(partner)).font(.caption).foregroundStyle(FateTheme.muted) }
                                Spacer(); if selected?.id == partner.id { Image(systemName: "checkmark").foregroundStyle(FateTheme.gold) }
                            }
                        }.swipeActions { Button("削除", role: .destructive) { Task { await delete(partner) } } }
                    }
                }
            }.navigationTitle("相手を選ぶ").toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { showPicker = false } } }
        }
    }

    private func typeLabel(_ partner: PartnerProfile) -> String { partner.relationshipType == "friend" ? "友人" : "恋愛" }
    private func load(selectNewest: Bool = false) async {
        do { let response = try await APIClient.shared.partnerProfiles(auth: auth); partners = response.partners; remaining = response.remaining
            if selectNewest { selected = partners.last } else if let selected, !partners.contains(selected) { self.selected = nil }
        } catch { errorMessage = error.localizedDescription }
    }
    private func delete(_ partner: PartnerProfile) async {
        do { try await APIClient.shared.deletePartner(id: partner.id, auth: auth); if selected?.id == partner.id { selected = nil }; await load() }
        catch { errorMessage = error.localizedDescription }
    }
}

private struct PartnerRegistrationView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var name = ""; @State private var date = Date(); @State private var hasTime = false; @State private var time = Date()
    @State private var birthplace = "東京都"; @State private var gender = "female"; @State private var relationship = "romantic"; @State private var error: String?
    var body: some View {
        NavigationStack { Form {
            TextField("表示名", text: $name)
            DatePicker("生年月日", selection: $date, displayedComponents: .date)
            Toggle("出生時刻を入力する", isOn: $hasTime)
            if hasTime { DatePicker("出生時刻", selection: $time, displayedComponents: .hourAndMinute) }
            TextField("出生地", text: $birthplace)
            Picker("性別", selection: $gender) { Text("女性").tag("female"); Text("男性").tag("male") }
            Picker("関係性", selection: $relationship) { Text("恋愛").tag("romantic"); Text("友人").tag("friend") }
            if let error { Text(error).foregroundStyle(.red) }
        }.navigationTitle("新しく相手を登録する").toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("登録") { Task { await save() } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) }
        } }
    }
    private func save() async {
        let dateText = date.formatted(.iso8601.year().month().day())
        let timeText = hasTime ? time.formatted(.iso8601.time(includingFractionalSeconds: false)) : nil
        do { _ = try await APIClient.shared.createPartner(displayName: name, birthDate: dateText, birthTime: timeText, birthplace: birthplace, gender: gender, relationshipType: relationship, auth: auth); await onSaved(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
