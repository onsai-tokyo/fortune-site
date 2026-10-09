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

@MainActor
enum CompatibilityOpening {
    enum Destination {
        case saved(UUID)
        case generated(StructuredReportResponse)
    }

    /// A failed history read must not turn into another paid generation.
    static func resolve(selfReading: ReadingSummary, partner: PartnerProfile, relationshipType: String, relationshipLabel: String,
                        readings: () async throws -> CompatibilityHistory,
                        cards: (UUID) async throws -> StructuredReportResponse,
                        generate: () async throws -> StructuredReportResponse) async throws -> Destination {
        let history = try await readings()
        for reading in history.readings where reading.matchesCompatibility(selfReading: selfReading, partner: partner, relationshipType: relationshipType) {
            let report = try await cards(reading.id)
            let storedLabels = Set(report.cards.flatMap(\.tags)).intersection(relationshipOptions)
            // Older reports only persisted the broad relationship type. Open
            // their saved text as-is instead of charging to recreate the pair.
            if storedLabels.isEmpty || storedLabels.contains(relationshipLabel) { return .saved(reading.id) }
        }
        guard history.complete else {
            throw APIError.server("保存済みの鑑定をすべて確認できませんでした。新しい鑑定は作成していません。「鑑定書」タブから確認するか、時間をおいて再試行してください。")
        }
        return .generated(try await generate())
    }
}

struct PartnerProfilesView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @EnvironmentObject private var tabRouter: AppTabRouter
    @Environment(\.scenePhase) private var scenePhase
    @State private var partners: [PartnerProfile] = []
    @State private var selected: PartnerProfile?
    @State private var remaining = 0
    @State private var partnerLimit = 1
    private enum PickerAction { case register, paywall, edit(PartnerProfile) }
    @State private var pickerAction: PickerAction?
    @State private var showPicker = false
    @State private var showRegistration = false
    @State private var profileToEdit: PartnerProfile?
    @State private var hasLoaded = false
    @State private var errorMessage: String?
    @State private var errorKind: FLErrorState.Kind = .dataFetch
    @State private var relationshipType = "romantic"
    @State private var relationshipLabel = "お付き合い中"
    @State private var compatibilityReport: StructuredReportResponse?
    @State private var compatibilityKey: String?
    @State private var savedCompatibilityID: UUID?
    @State private var showCompatibilityResult = false
    @State private var isGenerating = false
    @State private var generationProgress = GenerationProgress(percent: 5, title: "二人の情報を確認しています", detail: "鑑定に使うプロフィールを準備しています")
    @State private var selfReading: ReadingSummary?
    @State private var compatibilityFailed = false
    @State private var needsPurchaseRecovery = false
    @State private var showPaywall = false

    var body: some View {
        ZStack { ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                FateEditorialHero(eyebrow: "TWO STORIES", title: "ふたりのパターン", subtitle: "違いを知る。重なりを見つける。")
                    .padding(.bottom, 28)
                HStack { Text("相手を選ぶ").font(FateType.sectionTitle); Spacer(); Text("\(partners.count) / \(partnerLimit)人").font(.caption).foregroundStyle(FateTheme.muted) }
                    .padding(.bottom, 14)
                HStack(spacing: 16) {
                        profileTile(title: ownerDisplayName, subtitle: "", icon: "person", isEmpty: false)
                        Text("&").font(.callout).foregroundStyle(FateTheme.muted)
                        Button { showPicker = true } label: {
                            profileTile(title: selected?.displayName ?? "相手を選ぶ",
                                        subtitle: selected == nil ? "未設定" : relationshipLabel,
                                        icon: selected == nil ? "plus" : "person", isEmpty: selected == nil)
                        }.buttonStyle(.plain)
                }.padding(.vertical, 24)
                    .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 24))
                    .overlay(RoundedRectangle(cornerRadius: 24).stroke(FateTheme.line, lineWidth: 0.5))
                    .padding(.bottom, 20)
                Text(selected == nil ? "右の相手ボタンを押して、鑑定したい相手を登録・選択してください。" : "相手のボタンから、相手の変更・追加ができます。")
                    .font(.footnote).foregroundStyle(FateTheme.muted).padding(.bottom, 16)
                Menu {
                    ForEach(relationshipOptions, id: \.self) { label in
                        Button(label) { relationshipLabel = label; relationshipType = relationshipGroup(label) }
                    }
                } label: {
                    HStack { Text("関係性"); Spacer(); Text(relationshipLabel).foregroundStyle(FateTheme.muted); Image(systemName: "chevron.up.chevron.down") }
                        .padding(.vertical, 14)
                }.font(.subheadline).padding(.horizontal, 18).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 16)).disabled(selected == nil).padding(.bottom, 24)
                if selfReading == nil {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("まず「あなたについて」の鑑定を作成してください。")
                            .font(.callout).foregroundStyle(FateTheme.muted)
                        Button("あなたの鑑定を作成する") { tabRouter.selectedTab = .you }
                            .buttonStyle(FLSecondaryButtonStyle())
                    }.padding(.bottom, 12)
                } else if let selfReading {
                    Text("使用する自己鑑定：\(selfReading.title)").font(.caption).foregroundStyle(FateTheme.muted)
                        .padding(.bottom, 12)
                }
                Button { Task { await openCompatibility() } } label: {
                    Text("ふたりの鑑定を開く")
                }
                    .buttonStyle(FLPrimaryButtonStyle()).disabled(selected == nil || selfReading == nil || isGenerating)
                    .padding(.top, selected == nil ? 12 : 0).padding(.bottom, 12)
                Text(verbatim: "残り\(remaining)人まで登録できます").font(.caption).foregroundStyle(FateTheme.muted)
                if let errorMessage {
                    if needsPurchaseRecovery {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("相性鑑定の利用回数について").font(.headline)
                            Text(errorMessage).font(.callout).foregroundStyle(FateTheme.muted)
                            if AppConfig.storeKitEnabled {
                            Button("購入を復元") {
                                Task { await purchases.restore(auth: auth); await openCompatibility(force: true) }
                            }.buttonStyle(FLPrimaryButtonStyle())
                            if !purchases.isPremium { Button("継続鑑定を始める") { showPaywall = true }.buttonStyle(FLSecondaryButtonStyle()) }
                            } else {
                                Text(AppConfig.purchasesUnavailableMessage).font(.callout)
                            }
                        }.padding(18).background(FateTheme.surface).clipShape(RoundedRectangle(cornerRadius: 14))
                    } else {
                        FLErrorState(
                            title: errorKind == .network ? "通信エラーが発生しました" : "相性鑑定を完了できませんでした",
                            message: errorMessage
                        ) { Task { if compatibilityFailed { await openCompatibility(force: true) } else { await load() } } }
                    }
                }
            }.padding(FateSpacing.screenH)
        }; if isGenerating { ReadingGenerationProgressView(kind: .compatibility, progress: generationProgress) } }
        .background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
        .toolbar(isGenerating ? .hidden : .visible, for: .tabBar)
        .task { await refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refresh() } }
        }
        .onChange(of: purchases.isPremium) { _, _ in Task { await load() } }
        .sheet(isPresented: $showPicker, onDismiss: {
            switch pickerAction {
            case .register: showRegistration = true
            case .paywall: showPaywall = true
            case .edit(let partner): profileToEdit = partner
            case nil: break
            }
            pickerAction = nil
        }) { pickerSheet }
        .sheet(isPresented: $showRegistration, onDismiss: { Task { await load() } }) { PartnerRegistrationView(selfReading: selfReading) { await load(selectNewest: true) } }
        .sheet(item: $profileToEdit) { partner in
            NavigationStack {
                Form {
                    Section("相手のプロフィール") {
                        LabeledContent("表示名", value: partner.displayName)
                        LabeledContent("生年月日", value: partner.birthDate)
                        LabeledContent("出生時刻", value: partner.birthTime ?? "不明")
                        LabeledContent("出生地", value: partner.birthplace)
                    }
                    Section { CoupleMeetingYearEditor(partnerID: partner.id, selfReadingID: selfReading?.id) }
                }.scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("相手のプロフィール")
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { profileToEdit = nil } } }
            }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallSheet(draftQuestion: "") {
                Task { await purchases.sync(auth: auth); await load(); showPaywall = false }
            }.environmentObject(auth).environmentObject(purchases)
        }
        .navigationDestination(isPresented: $showCompatibilityResult) {
            if let savedCompatibilityID {
                SavedReadingView(conversationID: savedCompatibilityID, readingKind: "compatibility")
            } else if let compatibilityReport, let selected {
                CompatibilityResultView(report: compatibilityReport, partnerName: selected.displayName, relationshipType: relationshipType) { card in
                    guard let conversationID = compatibilityReport.conversationID else {
                        errorMessage = "この相性鑑定を開き直してください。"
                        showCompatibilityResult = false
                        return
                    }
                    tabRouter.openBook(conversationID: conversationID, card: card)
                }
            }
        }
    }

    private var ownerDisplayName: String {
        if let name = selfReading?.ownerDisplayName { return name }
        return AccountStorage.birthProfile(userID: auth.userID)?.nickname.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "あなた"
    }

    private func profileTile(title: String, subtitle: String, icon: String, isEmpty: Bool) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(LinearGradient(colors: [FateTheme.cream, FateTheme.surface], startPoint: .topLeading, endPoint: .bottomTrailing))
                Circle().stroke(FateTheme.line, lineWidth: 0.5)
                Image(systemName: icon).font(.system(size: 26, weight: .light))
                    .foregroundStyle(isEmpty ? FateTheme.ink : FateTheme.muted)
            }.frame(width: 68, height: 68)
            Text(title).font(.system(.subheadline, weight: .medium)).foregroundStyle(FateTheme.ink)
            Text(subtitle).font(.system(.caption)).foregroundStyle(FateTheme.muted).fixedSize(horizontal: false, vertical: true)
        }.frame(maxWidth: .infinity)
    }

    private var pickerSheet: some View {
        NavigationStack {
            List {
                Section {
                    Button("新しく相手を登録する") {
                        if remaining > 0 { pickerAction = .register; showPicker = false }
                        else if !purchases.isPremium { pickerAction = .paywall; showPicker = false }
                        else { Task { await load() } }
                    }.disabled(purchases.isSyncing || purchases.accessState == .unknown || (remaining == 0 && partnerLimit >= 10))
                    if remaining == 0 && partnerLimit < 10 && !purchases.isPremium {
                        Text("無料プランは1人まで。月額会員は10人まで登録できます。")
                            .font(.footnote).foregroundStyle(FateTheme.muted)
                        Button("月額プランを見る") { pickerAction = .paywall; showPicker = false }
                    }
                } footer: { Text(remaining == 0 ? "登録済みの相手はそのまま残ります。右へスワイプで編集、左へスワイプで削除できます。" : "残り\(remaining)人まで登録できます") }

                Section("登録済みの相手") {
                    ForEach(partners) { partner in
                        VStack(alignment: .leading, spacing: 8) {
                        Button { selectPartner(partner); showPicker = false } label: {
                            HStack {
                                Image(systemName: "person.crop.circle").foregroundStyle(FateTheme.ink)
                                VStack(alignment: .leading) { Text(partner.displayName); Text(typeLabel(partner)).font(.caption).foregroundStyle(FateTheme.muted) }
                                Spacer(); if selected?.id == partner.id { Image(systemName: "checkmark").foregroundStyle(FateTheme.ink) }
                            }
                        }.buttonStyle(.plain)
                        .contextMenu { Button("プロフィール・出会った年を編集") { pickerAction = .edit(partner); showPicker = false } }
                        }.swipeActions(edge: .leading) { Button("編集") { pickerAction = .edit(partner); showPicker = false } }
                        .swipeActions { Button("削除", role: .destructive) { Task { await delete(partner) } } }
                    }
                }
            }.task { await refresh() }.scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("相手を選ぶ").toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { showPicker = false } } }
        }
    }

    private func selectPartner(_ partner: PartnerProfile?) {
        selected = partner
        relationshipType = partner?.relationshipType ?? "romantic"
        relationshipLabel = partner.map(typeLabel) ?? "お付き合い中"
        compatibilityReport = nil
        compatibilityKey = nil
        savedCompatibilityID = nil
        errorMessage = nil
        needsPurchaseRecovery = false
    }

    private func typeLabel(_ partner: PartnerProfile) -> String { partner.relationshipLabel ?? (partner.relationshipType == "friend" ? "友人" : "お付き合い中") }
    private func refresh() async {
        // Show saved partners without waiting for StoreKit history enumeration.
        async let membership: Void = purchases.sync(auth: auth)
        await load()
        await membership
    }

    private func load(selectNewest: Bool = false) async {
        let owner = AccountScope(auth)
        errorMessage = nil
        do {
            async let profiles = APIClient.shared.partnerProfiles(auth: auth)
            async let readings = APIClient.shared.readings(auth: auth)
            let (response, availableReadings) = try await (profiles, readings)
            try owner.check(auth)
            hasLoaded = true
            partners = response.partners
            remaining = response.remaining
            partnerLimit = response.limit
            // A compatibility conversation can be the most recently updated item.
            // It must never be reused as the source "self" reading.
            selfReading = availableReadings.first(where: { !$0.isCompatibility && !$0.isChat })
            if selectNewest { selectPartner(partners.last) } else if let selected, !partners.contains(selected) { self.selected = nil }
        } catch { if owner.isCurrent(auth) { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) } }
    }
    private func delete(_ partner: PartnerProfile) async {
        do { try await APIClient.shared.deletePartner(id: partner.id, auth: auth); if selected?.id == partner.id { selected = nil }; await load() }
        catch { errorMessage = userFacingMessage(error); errorKind = errorStateKind(error) }
    }
    private func openCompatibility(force: Bool = false) async {
        guard !isGenerating, let selected, let selfReading else { return }
        let owner = AccountScope(auth)
        let type = relationshipType, label = relationshipLabel
        let key = "\(owner.userID?.uuidString ?? "")|\(owner.epoch)|\(selected.id.uuidString)|\(selfReading.id.uuidString)|\(type)|\(label)"
        if !force, compatibilityKey == key, compatibilityReport != nil || savedCompatibilityID != nil {
            showCompatibilityResult = true
            return
        }
        isGenerating = true; errorMessage = nil; compatibilityFailed = false; needsPurchaseRecovery = false; defer { isGenerating = false }
        generationProgress = GenerationProgress(percent: 5, title: "保存した鑑定を確認しています", detail: "同じ二人の鑑定書があれば、その内容を開きます")
        do {
            let destination = try await CompatibilityOpening.resolve(selfReading: selfReading, partner: selected, relationshipType: type, relationshipLabel: label,
                readings: {
                    let values = try await APIClient.shared.compatibilityHistory(partnerID: selected.id, auth: auth)
                    try owner.check(auth)
                    return values
                }, cards: { id in
                    let value = try await APIClient.shared.cards(id: id, auth: auth)
                    try owner.check(auth)
                    return value
                }, generate: {
                    try owner.check(auth)
                    return try await APIClient.shared.compatibility(partnerID: selected.id, conversationID: selfReading.id, relationshipType: type, relationshipLabel: label, auth: auth) { generationProgress = $0 }
                })
            try owner.check(auth)
            switch destination {
            case .saved(let id): savedCompatibilityID = id; compatibilityReport = nil
            case .generated(let report): compatibilityReport = report; savedCompatibilityID = nil
            }
            compatibilityKey = key
            showCompatibilityResult = true
        }
        catch {
            guard owner.isCurrent(auth), !(error is CancellationError) else { return }
            compatibilityFailed = true
            if case APIError.paymentRequired = error { needsPurchaseRecovery = true }
            errorMessage = userFacingMessage(error) ?? "相性鑑定をうまく作れませんでした。もう一度お試しください。"
            errorKind = errorStateKind(error)
        }
    }
}

private struct CompatibilityResultView: View {
    let report: StructuredReportResponse
    let partnerName: String
    let relationshipType: String
    let onQuestion: (ReadingCard) -> Void
    var body: some View {
        ReadingScrollView {
            InsightHubView(report: GeneratedReport(birthData: [:], calculatedData: [:], text: report.reportText, cards: report.cards, chartSections: report.chartSections ?? [], conversationID: report.conversationID), scope: .couple, onQuestion: onQuestion)
                .padding(FateSpacing.screenH)
        }.background(FateTheme.canvas).fateScreenTitle("ふたりの鑑定")
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
            Text(name).font(.system(.footnote, weight: .semibold)).foregroundStyle(FateTheme.ink)
            if let section {
                ChartSectionView(section: section)
            } else {
                FLEmptyState(title: "データがありません", message: "このプロフィールでは表示できません。")
            }
        }
        .frame(width: 280, alignment: .topLeading)
    }
}

struct PartnerRegistrationView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    let selfReading: ReadingSummary?
    let onSaved: () async -> Void
    @State private var meetingYear = ""
    @State private var createdPartner: PartnerProfile?
    @State private var isWorking = false
    @State private var name = ""; @State private var date = Calendar.current.date(from: DateComponents(year: 1990, month: 1, day: 1))!; @State private var birthTime: Date?
    @State private var birthplace = "東京都"; @State private var gender = "female"; @State private var relationshipLabel = "お付き合い中"; @State private var error: String?
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment: .leading, spacing: 18) {
            Text("新しく相手を登録する").font(.system(.title2, weight: .medium))
            Text("表示名").font(.system(.caption, weight: .medium)).foregroundStyle(FateTheme.muted)
            TextField("呼び名", text: $name, prompt: Text("呼び名").foregroundStyle(FateTheme.muted)).disabled(createdPartner != nil).fateInput().accessibilityLabel("呼び名")
            Text("出会った年（任意）").font(.subheadline)
            TextField("例：2023", text: $meetingYear, prompt: Text("例：2023").foregroundStyle(FateTheme.muted)).keyboardType(.numberPad).fateInput().accessibilityLabel("出会った年")
            Text("初めて知り合った年。この年からふたりの時系列を表示します。")
                .font(.caption).foregroundStyle(FateTheme.muted)
            FLDivider()
            BirthProfileFields(date: $date, birthTime: $birthTime, birthplace: $birthplace, gender: $gender).disabled(createdPartner != nil).padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
            Text("関係").font(.system(.caption, weight: .medium)).foregroundStyle(FateTheme.muted)
            Picker("関係", selection: $relationshipLabel) { ForEach(relationshipOptions, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu).disabled(createdPartner != nil)
            if let error { Text(error).foregroundStyle(.red) }
            if error != nil && createdPartner == nil {
                DisclosureGroup("登録できない場合") {
                    Button("受付状況を確認") { Task { await recover(cancel: false) } }.disabled(isWorking)
                    Button("未完了の受付を取り消す") { Task { await recover(cancel: true) } }.disabled(isWorking)
                }.font(.footnote).tint(FateTheme.ink)
            }
        }.padding(20) }.background(FateTheme.canvas).toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("登録") { Task { await save() } }.disabled(isWorking || name.trimmingCharacters(in: .whitespaces).isEmpty) }
        } }
    }
    private func save() async {
        guard !isWorking else { return }; isWorking = true
        defer { isWorking = false }
        let dateText = Self.localDateText(date, calendar: .current)
        let timeText = birthTime.map { Self.localTimeText($0, calendar: .current) }
        let raw = meetingYear.trimmingCharacters(in: .whitespacesAndNewlines)
        let minimum = max(Int(dateText.prefix(4)) ?? 1900, Int(selfReading?.birthData?.birthDate?.prefix(4) ?? "0") ?? 0)
        let current = Calendar(identifier: .gregorian).component(.year, from: Date())
        if !raw.isEmpty && (raw.range(of: #"^[0-9]{4}$"#, options: .regularExpression) == nil || (Int(raw) ?? 0) < minimum || (Int(raw) ?? 0) > current) {
            error = "出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。"; return
        }
        do {
            if createdPartner == nil {
                createdPartner = try await APIClient.shared.createPartner(displayName: name, birthDate: dateText, birthTime: timeText, birthplace: birthplace, gender: gender, relationshipType: relationshipGroup(relationshipLabel), relationshipLabel: relationshipLabel, auth: auth)
            }
            guard let partner = createdPartner else { return }
            _ = try await APIClient.shared.coupleMeetingSettings(partnerID: partner.id, selfReadingID: selfReading?.id, saving: true, meetingYear: raw.isEmpty ? nil : Int(raw), auth: auth)
            await onSaved(); dismiss()
        }
        catch { self.error = createdPartner == nil ? userFacingMessage(error) : "相手の登録は完了しています。出会った年を保存できませんでした。もう一度「登録」を押してください。" }
    }

    private func recover(cancel: Bool) async {
        guard !isWorking else { return }; isWorking = true
        defer { isWorking = false }
        do {
            if let partner = try await APIClient.shared.recoverPartnerRegistration(auth: auth, cancel: cancel) {
                createdPartner = partner
                let raw = meetingYear.trimmingCharacters(in: .whitespacesAndNewlines)
                if !raw.isEmpty && (raw.range(of: #"^[0-9]{4}$"#, options: .regularExpression) == nil) {
                    error = "相手の登録は完了しています。出会った年を西暦4桁で入力してください。"; return
                }
                _ = try await APIClient.shared.coupleMeetingSettings(partnerID: partner.id, selfReadingID: selfReading?.id, saving: true, meetingYear: raw.isEmpty ? nil : Int(raw), auth: auth)
                await onSaved(); dismiss()
            } else { error = cancel ? "保留中の登録操作はありません" : "確認する登録操作はありません" }
        } catch { self.error = userFacingMessage(error) }
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

struct CoupleMeetingYearEditor: View {
    @EnvironmentObject private var auth: AuthStore
    let partnerID: UUID
    let selfReadingID: UUID?
    @State private var value = ""
    @State private var settings: CoupleMeetingSettings?
    @State private var busy = false
    @State private var message: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("出会った年（任意）").font(.subheadline.weight(.medium))
            TextField("例：2023", text: $value).keyboardType(.numberPad).textFieldStyle(.roundedBorder).accessibilityLabel("出会った年")
            Text("初めて知り合った年を入力してください。この年から、ふたりの時系列を表示します。未入力でも相性鑑定は利用できます。")
                .font(.caption).foregroundStyle(FateTheme.muted)
            Button(settings == nil ? "出会った年を再確認" : "出会った年を保存") { Task { await perform(save: settings != nil) } }
                .buttonStyle(FLSecondaryButtonStyle()).disabled(busy)
            if busy { ProgressView() }
            if let message { Text(message).font(.caption).foregroundStyle(FateTheme.muted) }
        }.padding(.bottom, 20).task { await perform(save: false) }
    }
    private func perform(save: Bool) async {
        guard !busy else { return }
        let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let year = Int(raw)
        if save, let settings, !raw.isEmpty,
           raw.range(of: #"^[0-9]{4}$"#, options: .regularExpression) == nil || year == nil || year! < settings.minMeetingYear || year! > settings.referenceYear {
            message = "ふたりが生まれた年以降から今年までの西暦4桁で入力してください。"; return
        }
        let owner = AccountScope(auth)
        busy = true; message = nil
        defer { busy = false }
        do {
            let result = try await APIClient.shared.coupleMeetingSettings(partnerID: partnerID, selfReadingID: selfReadingID, saving: save, meetingYear: raw.isEmpty ? nil : year, auth: auth)
            try owner.check(auth); guard !Task.isCancelled else { return }
            settings = result; value = result.meetingYear.map(String.init) ?? ""
            if save { message = "出会った年を保存しました。" }
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            message = "出会った年を確認・保存できませんでした。もう一度お試しください。"
        }
    }
}
