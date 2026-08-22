import SwiftUI

private let relationshipOptions = [
    "片思い", "お付き合い中", "婚約中", "夫婦", "復縁希望", "元恋人",
    "友人", "親友", "会社の同僚", "上司", "部下", "取引先",
    "親", "子", "兄弟姉妹", "配偶者の家族", "その他"
]
private func relationshipGroup(_ label: String) -> String {
    if ["片思い", "お付き合い中", "婚約中", "夫婦", "復縁希望", "元恋人"].contains(label) { return "romantic" }
    if ["親", "子", "兄弟姉妹", "配偶者の家族"].contains(label) { return "family" }
    return "friend"
}

struct PartnerProfilesView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var tabRouter: AppTabRouter
    @State private var partners: [PartnerProfile] = []
    @State private var selected: PartnerProfile?
    @State private var remaining = 2
    @State private var showPicker = false
    @State private var showRegistration = false
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch
    @State private var relationshipType = "romantic"
    @State private var relationshipLabel = "お付き合い中"
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
                Menu {
                    ForEach(relationshipOptions, id: \.self) { label in
                        Button(label) { relationshipLabel = label; relationshipType = relationshipGroup(label) }
                    }
                } label: {
                    HStack { Text("関係性"); Spacer(); Text(relationshipLabel).foregroundStyle(FateTheme.muted); Image(systemName: "chevron.up.chevron.down") }
                        .padding(.vertical, 14)
                }.disabled(selected == nil).padding(.bottom, 24)
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
                    FLErrorState(kind: errorKind) { Task { if compatibilityFailed { await openCompatibility(force: true) } else { await load() } } }
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
                CompatibilityResultView(report: compatibilityReport, partnerName: selected.displayName, relationshipType: relationshipType) { card in
                    guard let conversationID = compatibilityReport.conversationID else {
                        errorMessage = "この相性鑑定を開き直してください。"
                        showCompatibilityResult = false
                        return
                    }
                    tabRouter.openChat(conversationID: conversationID, contextTitle: card.title)
                }
            }
        }
    }

    private func profileTile(title: String, subtitle: String, icon: String, isEmpty: Bool) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color(red: 0.937, green: 0.914, blue: 0.867))
                Circle().stroke(FateTheme.line, lineWidth: 0.5)
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
                        Button { selected = partner; relationshipType = partner.relationshipType; relationshipLabel = partner.relationshipLabel ?? (partner.relationshipType == "friend" ? "友人" : "お付き合い中"); compatibilityReport = nil; compatibilityKey = nil; showPicker = false } label: {
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

    private func typeLabel(_ partner: PartnerProfile) -> String { partner.relationshipLabel ?? (partner.relationshipType == "friend" ? "友人" : "お付き合い中") }
    private func load(selectNewest: Bool = false) async {
        errorMessage = nil
        do {
            async let profiles = APIClient.shared.partnerProfiles(auth: auth)
            async let readings = APIClient.shared.readings(auth: auth)
            let (response, availableReadings) = try await (profiles, readings)
            partners = response.partners; remaining = response.remaining; selfReading = availableReadings.first
            if selectNewest { selected = partners.last } else if let selected, !partners.contains(selected) { self.selected = nil }
        } catch { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) }
    }
    private func delete(_ partner: PartnerProfile) async {
        do { try await APIClient.shared.deletePartner(id: partner.id, auth: auth); if selected?.id == partner.id { selected = nil }; await load() }
        catch { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) }
    }
    private func openCompatibility(force: Bool = false) async {
        guard let selected, let selfReading else { return }
        let key = "\(selected.id.uuidString)|\(selfReading.id.uuidString)|\(relationshipType)|\(relationshipLabel)"
        if !force, compatibilityKey == key, compatibilityReport != nil {
            showCompatibilityResult = true
            return
        }
        isGenerating = true; errorMessage = nil; compatibilityFailed = false; defer { isGenerating = false }
        do {
            compatibilityReport = try await APIClient.shared.compatibility(partnerID: selected.id, conversationID: selfReading.id, relationshipType: relationshipType, relationshipLabel: relationshipLabel, auth: auth) { generationProgress = $0 }
            compatibilityKey = key
            showCompatibilityResult = true
        }
        catch { compatibilityFailed = true; errorMessage = userFacingMessage(error) ?? "相性鑑定をうまく作れませんでした。もう一度お試しください。"; errorKind = errorStateKind(error) }
    }
}

private struct CompatibilityResultView: View {
    let report: StructuredReportResponse
    let partnerName: String
    let relationshipType: String
    let onQuestion: (ReadingCard) -> Void
    @State private var selectedTab = "essence"

    private var availableTabs: [(id: String, title: String)] {
        var tabs = [("essence", "二人の関係")]
        if report.cards.contains(where: { $0.resolvedTab == "timing" }) { tabs.append(("timing", "二人の節目")) }
        if !(report.chartSections ?? []).isEmpty { tabs.append(("chart", "二人の命式")) }
        return tabs
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("二人の関係性").font(FateType.screenTitle)
                Text("あなたと\(partnerName)さんの、\(relationshipType == "friend" ? "友情" : "恋愛")の物語を読み進める")
                    .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
                Picker("鑑定の章", selection: $selectedTab) {
                    ForEach(availableTabs, id: \.id) { tab in Text(tab.title).tag(tab.id) }
                }
                .pickerStyle(.segmented)
                if selectedTab == "chart" {
                    CoupleChartDetailsView(sections: report.chartSections ?? [], partnerName: partnerName)
                } else {
                    ReadingCardList(cards: report.cards.filter { $0.resolvedTab == selectedTab }, onQuestion: onQuestion)
                }
            }
            .padding(FateSpacing.screenH)
        }
        .background(FateTheme.canvas)
        .navigationTitle("相性鑑定")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct CoupleChartPair: Identifiable {
    let id: String
    let title: String
    let selfSection: ChartSection?
    let partnerSection: ChartSection?
}

struct CoupleChartDetailsView: View {
    let sections: [ChartSection]
    let partnerName: String

    private var pairs: [CoupleChartPair] {
        let orderedKeys = sections.reduce(into: [String]()) { keys, section in
            let key = "\(section.system)|\(section.title)"
            if !keys.contains(key) { keys.append(key) }
        }
        return orderedKeys.map { key in
            let matching = sections.filter { "\($0.system)|\($0.title)" == key }
            return CoupleChartPair(
                id: key,
                title: matching.first?.title ?? "命式",
                selfSection: matching.first(where: { $0.owner == "self" }),
                partnerSection: matching.first(where: { $0.owner == "partner" })
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("同じ計算結果を並べて、二人の違いと重なりを確かめる")
                .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
            ForEach(pairs) { pair in
                VStack(alignment: .leading, spacing: 12) {
                    FLSectionHeader(title: pair.title)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 12) {
                            ownerColumn(name: "あなた", section: pair.selfSection)
                            ownerColumn(name: partnerName, section: pair.partnerSection)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func ownerColumn(name: String, section: ChartSection?) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(name).font(.system(size: 14, weight: .semibold)).foregroundStyle(FateTheme.ink)
            if let section {
                ChartSectionView(section: section)
            } else {
                FLEmptyState(title: "データがありません", message: "このプロフィールでは表示できません。")
            }
        }
        .frame(width: 280, alignment: .topLeading)
    }
}

private struct PartnerRegistrationView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let onSaved: () async -> Void
    @State private var name = ""; @State private var date = Calendar.current.date(from: DateComponents(year: 1990, month: 1, day: 1))!; @State private var birthTime: Date?
    @State private var birthplace = "東京都"; @State private var gender = "female"; @State private var relationshipLabel = "お付き合い中"; @State private var error: String?
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("新しく相手を登録する").font(.system(size: 25, weight: .medium))
            Text("表示名").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            TextField("呼び名", text: $name).padding(.vertical, 12); FLDivider()
            BirthProfileFields(date: $date, birthTime: $birthTime, birthplace: $birthplace, gender: $gender)
            FLDivider()
            Text("関係").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            Picker("関係", selection: $relationshipLabel) { ForEach(relationshipOptions, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
            if let error { Text(error).foregroundStyle(.red) }
        }.padding(20) }.background(FateTheme.canvas).toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("登録") { Task { await save() } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) }
        } }
    }
    private func save() async {
        let dateText = Self.localDateText(date, calendar: .current)
        let timeText = birthTime.map { Self.localTimeText($0, calendar: .current) }
        do { _ = try await APIClient.shared.createPartner(displayName: name, birthDate: dateText, birthTime: timeText, birthplace: birthplace, gender: gender, relationshipType: relationshipGroup(relationshipLabel), relationshipLabel: relationshipLabel, auth: auth); await onSaved(); dismiss() }
        catch { self.error = userFacingMessage(error) }
    }

    static func localDateText(_ value: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: value)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    static func localTimeText(_ value: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.hour, .minute], from: value)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }
}
