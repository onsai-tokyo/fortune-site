import SwiftUI

struct PartnerProfilesView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var partners: [PartnerProfile] = []
    @State private var selected: PartnerProfile?
    @State private var remaining = 2
    @State private var showPicker = false
    @State private var showRegistration = false
    @State private var errorMessage: String?
    @State private var relationshipType = "romantic"
    @State private var compatibilityReport: StructuredReportResponse?
    @State private var isGenerating = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("あの人とについて").font(.system(size: 30, weight: .medium, design: .serif))
                    .padding(.bottom, 24)
                Text("二人のプロフィールを重ねて、関係の中で表れやすい力を読みます。")
                    .foregroundStyle(FateTheme.muted).padding(.bottom, 32)
                HStack(spacing: 16) {
                        profileTile(title: "あなた", subtitle: "", icon: "person", isEmpty: false)
                        Text("&").font(.callout).foregroundStyle(FateTheme.secondaryText)
                        Button { showPicker = true } label: {
                            profileTile(title: selected?.displayName ?? "相手を選ぶ",
                                        subtitle: selected.map(typeLabel) ?? "未設定", icon: selected == nil ? "plus" : "person", isEmpty: selected == nil)
                        }.buttonStyle(.plain)
                }.padding(.bottom, 28)
                Picker("関係性", selection: $relationshipType) {
                    Text("恋愛").tag("romantic"); Text("友人").tag("friend")
                }.pickerStyle(.segmented).disabled(selected == nil).padding(.bottom, 24)
                if selected == nil {
                    Text("先に相手を登録または選択してください。")
                        .font(.callout).foregroundStyle(FateTheme.muted)
                }
                Button { Task { await generateCompatibility() } } label: {
                    HStack { if isGenerating { ProgressView().tint(FateTheme.buttonText) }; Text("相性・関係性の鑑定結果へ進む") }
                }
                    .buttonStyle(GoldButtonStyle()).disabled(selected == nil || isGenerating).opacity(selected == nil ? 0.45 : 1)
                    .padding(.top, selected == nil ? 12 : 0).padding(.bottom, 12)
                if let compatibilityReport {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("二人の関係性").font(.system(size: 24, weight: .medium, design: .serif))
                        ForEach(compatibilityReport.cards) { card in
                            NavigationLink { InsightDetailView(item: card) {} } label: {
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(card.title).font(.headline).foregroundStyle(FateTheme.ink)
                                    Text(card.summary).font(.subheadline).foregroundStyle(FateTheme.muted).lineLimit(3)
                                }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
                                    .background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line))
                            }
                        }
                    }
                }
                Text(verbatim: "残り\(remaining)人まで登録できます").font(.caption).foregroundStyle(FateTheme.muted)
                if let errorMessage {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(errorMessage).foregroundStyle(.red).font(.caption)
                        Button("再試行") { Task { await load() } }.buttonStyle(OutlineGoldButtonStyle())
                    }
                }
            }.padding(20)
        }
        .background(FateTheme.ivory).navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $showPicker) { pickerSheet }
        .sheet(isPresented: $showRegistration) { PartnerRegistrationView { await load(selectNewest: true) } }
    }

    private func profileTile(title: String, subtitle: String, icon: String, isEmpty: Bool) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color(red: 0.937, green: 0.914, blue: 0.867))
                Circle().stroke(isEmpty ? FateTheme.accent : FateTheme.border, lineWidth: 0.5)
                Image(systemName: icon).font(.system(size: 26, weight: .light))
                    .foregroundStyle(isEmpty ? FateTheme.accent : FateTheme.secondaryText)
            }.frame(width: 68, height: 68)
            Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(FateTheme.ink)
            Text(subtitle).font(.system(size: 13)).foregroundStyle(FateTheme.muted).lineLimit(1)
        }.frame(maxWidth: .infinity)
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
                        Button { selected = partner; relationshipType = partner.relationshipType; compatibilityReport = nil; showPicker = false } label: {
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
        errorMessage = nil
        do { let response = try await APIClient.shared.partnerProfiles(auth: auth); partners = response.partners; remaining = response.remaining
            if selectNewest { selected = partners.last } else if let selected, !partners.contains(selected) { self.selected = nil }
        } catch { errorMessage = userFacingMessage(error) }
    }
    private func delete(_ partner: PartnerProfile) async {
        do { try await APIClient.shared.deletePartner(id: partner.id, auth: auth); if selected?.id == partner.id { selected = nil }; await load() }
        catch { errorMessage = userFacingMessage(error) }
    }
    private func generateCompatibility() async {
        guard let selected else { return }
        isGenerating = true; errorMessage = nil; defer { isGenerating = false }
        do { compatibilityReport = try await APIClient.shared.compatibility(partnerID: selected.id, relationshipType: relationshipType, auth: auth) }
        catch { errorMessage = userFacingMessage(error) }
    }
}

private struct PartnerRegistrationView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var name = ""; @State private var date = Date(); @State private var hasTime = false; @State private var time = Date()
    @State private var birthplace = "東京都"; @State private var gender = "female"; @State private var relationship = "romantic"; @State private var error: String?
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("新しく相手を登録する").font(.system(size: 25, weight: .medium, design: .serif))
            TextField("表示名", text: $name).padding(12).overlay(RoundedRectangle(cornerRadius: 9).stroke(FateTheme.border))
            DateMenuPicker(date: $date)
            Divider().overlay(FateTheme.border)
            Toggle("出生時刻を入力する", isOn: $hasTime)
            if hasTime { DatePicker("出生時刻", selection: $time, displayedComponents: .hourAndMinute) }
            Divider().overlay(FateTheme.border)
            TextField("出生地", text: $birthplace)
            Picker("性別", selection: $gender) { Text("女性").tag("female"); Text("男性").tag("male") }
            Picker("関係性", selection: $relationship) { Text("恋愛").tag("romantic"); Text("友人").tag("friend") }
            if let error { Text(error).foregroundStyle(.red) }
        }.padding(20) }.background(FateTheme.background).toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("登録") { Task { await save() } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) }
        } }
    }
    private func save() async {
        let dateText = date.formatted(.iso8601.year().month().day())
        let timeText = hasTime ? time.formatted(.iso8601.time(includingFractionalSeconds: false)) : nil
        do { _ = try await APIClient.shared.createPartner(displayName: name, birthDate: dateText, birthTime: timeText, birthplace: birthplace, gender: gender, relationshipType: relationship, auth: auth); await onSaved(); dismiss() }
        catch { self.error = userFacingMessage(error) }
    }
}
