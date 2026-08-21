import SwiftUI

struct PartnerProfilesView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    @State private var partners: [PartnerProfile] = []
    @State private var selected: PartnerProfile?
    @State private var remaining = 2
    @State private var showPicker = false
    @State private var showRegistration = false
    @State private var errorMessage: String?
    @State private var relationshipType = "romantic"
    @State private var compatibilityReport: StructuredReportResponse?
    @State private var compatibilityKey: String?
    @State private var showCompatibilityResult = false
    @State private var isGenerating = false
    @State private var generationProgress = GenerationProgress(percent: 5, title: "二人の情報を確認しています", detail: "鑑定に使うプロフィールを準備しています")
    @State private var selfReading: ReadingSummary?
    @State private var compatibilityFailed = false

    var body: some View {
        ZStack { ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("ふたりのパターン").font(FateType.screenTitle)
                    .padding(.bottom, 24)
                Text("二人の関係に、いま何が起きているか。")
                    .foregroundStyle(FateTheme.muted).padding(.bottom, 32)
                HStack(spacing: 16) {
                        profileTile(title: "あなた", subtitle: "", icon: "person", isEmpty: false)
                        Text("&").font(.callout).foregroundStyle(FateTheme.muted)
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
                if selfReading == nil {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("まず「あなたについて」の鑑定を作成してください。")
                            .font(.callout).foregroundStyle(FateTheme.muted)
                        Button("あなたの鑑定を作成する") { tabRouter.selectedTab = 0 }
                            .buttonStyle(FLSecondaryButtonStyle())
                    }.padding(.bottom, 12)
                } else if let selfReading {
                    Text("使用する自己鑑定：\(selfReading.title)").font(.caption).foregroundStyle(FateTheme.muted)
                        .padding(.bottom, 12)
                }
                Button { Task { await openCompatibility() } } label: {
                    Text("相性・関係性の鑑定結果へ進む")
                }
                    .buttonStyle(FLPrimaryButtonStyle()).disabled(selected == nil || selfReading == nil || isGenerating).opacity(selected == nil || selfReading == nil ? 0.45 : 1)
                    .padding(.top, selected == nil ? 12 : 0).padding(.bottom, 12)
                Text(verbatim: "残り\(remaining)人まで登録できます").font(.caption).foregroundStyle(FateTheme.muted)
                if let errorMessage {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(errorMessage).foregroundStyle(.red).font(.caption)
                        Button("もう一度試す") { Task { if compatibilityFailed { await openCompatibility(force: true) } else { await load() } } }.buttonStyle(FLSecondaryButtonStyle())
                    }
                }
            }.padding(FateSpacing.screenH)
        }; if isGenerating { ReadingGenerationProgressView(kind: .compatibility, progress: generationProgress) } }
        .background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
        .toolbar(isGenerating ? .hidden : .visible, for: .tabBar)
        .task { await load() }
        .sheet(isPresented: $showPicker) { pickerSheet }
        .sheet(isPresented: $showRegistration) { PartnerRegistrationView { await load(selectNewest: true) } }
        .navigationDestination(isPresented: $showCompatibilityResult) {
            if let compatibilityReport, let selected {
                CompatibilityResultView(report: compatibilityReport, partnerName: selected.displayName, relationshipType: relationshipType)
            }
        }
    }

    private func profileTile(title: String, subtitle: String, icon: String, isEmpty: Bool) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color(red: 0.937, green: 0.914, blue: 0.867))
                Circle().stroke(isEmpty ? FateTheme.ink : FateTheme.line, lineWidth: 0.5)
                Image(systemName: icon).font(.system(size: 26, weight: .light))
                    .foregroundStyle(isEmpty ? FateTheme.ink : FateTheme.muted)
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
                        Button { selected = partner; relationshipType = partner.relationshipType; compatibilityReport = nil; compatibilityKey = nil; showPicker = false } label: {
                            HStack {
                                Image(systemName: "person.crop.circle").foregroundStyle(FateTheme.ink)
                                VStack(alignment: .leading) { Text(partner.displayName); Text(typeLabel(partner)).font(.caption).foregroundStyle(FateTheme.muted) }
                                Spacer(); if selected?.id == partner.id { Image(systemName: "checkmark").foregroundStyle(FateTheme.ink) }
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
        do {
            async let profiles = APIClient.shared.partnerProfiles(auth: auth)
            async let readings = APIClient.shared.readings(auth: auth)
            let (response, availableReadings) = try await (profiles, readings)
            partners = response.partners; remaining = response.remaining; selfReading = availableReadings.first
            if selectNewest { selected = partners.last } else if let selected, !partners.contains(selected) { self.selected = nil }
        } catch { errorMessage = userFacingMessage(error) }
    }
    private func delete(_ partner: PartnerProfile) async {
        do { try await APIClient.shared.deletePartner(id: partner.id, auth: auth); if selected?.id == partner.id { selected = nil }; await load() }
        catch { errorMessage = userFacingMessage(error) }
    }
    private func openCompatibility(force: Bool = false) async {
        guard let selected, let selfReading else { return }
        let key = "\(selected.id.uuidString)|\(selfReading.id.uuidString)|\(relationshipType)"
        if !force, compatibilityKey == key, compatibilityReport != nil {
            showCompatibilityResult = true
            return
        }
        isGenerating = true; errorMessage = nil; compatibilityFailed = false; defer { isGenerating = false }
        do {
            compatibilityReport = try await APIClient.shared.compatibility(partnerID: selected.id, conversationID: selfReading.id, relationshipType: relationshipType, auth: auth) { generationProgress = $0 }
            compatibilityKey = key
            showCompatibilityResult = true
        }
        catch { compatibilityFailed = true; errorMessage = userFacingMessage(error) ?? "相性鑑定をうまく作れませんでした。もう一度お試しください。" }
    }
}

private struct CompatibilityResultView: View {
    let report: StructuredReportResponse
    let partnerName: String
    let relationshipType: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("二人の関係性").font(FateType.screenTitle)
                Text("あなたと\(partnerName)さんの、\(relationshipType == "friend" ? "友情" : "恋愛")の物語を読み進める")
                    .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
                ReadingCardList(cards: report.cards) { _ in }
            }
            .padding(FateSpacing.screenH)
        }
        .background(FateTheme.canvas)
        .navigationTitle("相性鑑定")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct PartnerRegistrationView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var name = ""; @State private var date = Date(); @State private var birthTime: Date?
    @State private var birthplace = "東京都"; @State private var gender = "female"; @State private var relationship = "romantic"; @State private var error: String?
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("新しく相手を登録する").font(.system(size: 25, weight: .medium))
            TextField("表示名", text: $name).padding(12).overlay(RoundedRectangle(cornerRadius: 9).stroke(FateTheme.line))
            DateMenuPicker(date: $date)
            Divider().overlay(FateTheme.line)
            if birthTime == nil { Button("出生時刻を入力する（任意）") { birthTime = Date() } }
            else { DatePicker("出生時刻（任意）", selection: Binding(get: { birthTime ?? Date() }, set: { birthTime = $0 }), displayedComponents: .hourAndMinute); Button("出生時刻をクリア") { birthTime = nil } }
            Divider().overlay(FateTheme.line)
            TextField("出生地", text: $birthplace)
            Picker("性別", selection: $gender) { Text("女性").tag("female"); Text("男性").tag("male") }
            Picker("関係性", selection: $relationship) { Text("恋愛").tag("romantic"); Text("友人").tag("friend") }
            if let error { Text(error).foregroundStyle(.red) }
        }.padding(20) }.background(FateTheme.canvas).toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("登録") { Task { await save() } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) }
        } }
    }
    private func save() async {
        let dateText = date.formatted(.iso8601.year().month().day())
        let timeText = birthTime?.formatted(.iso8601.time(includingFractionalSeconds: false))
        do { _ = try await APIClient.shared.createPartner(displayName: name, birthDate: dateText, birthTime: timeText, birthplace: birthplace, gender: gender, relationshipType: relationship, auth: auth); await onSaved(); dismiss() }
        catch { self.error = userFacingMessage(error) }
    }
}
