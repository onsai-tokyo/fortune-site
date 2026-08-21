import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input: BirthInput
    @State private var report: GeneratedReport?
    @State private var isWorking = false
    @State private var progress = GenerationProgress(percent: 5, title: "入力内容を確認しています", detail: "生年月日と出生地を確認しています")
    @State private var showDatePicker = false
    @State private var draftDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var showTimePicker = false
    @State private var showBirthplacePicker = false
    @State private var showGenderPicker = false
    @State private var draftTime = Calendar.current.date(from: DateComponents(hour: 12, minute: 0)) ?? Date()
    @State private var errorMessage: String?
    @State private var saveErrorMessage: String?
    private let autoGenerate: Bool
    @State private var didAutoGenerate = false
    private let prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]

    init(initialInput: BirthInput? = nil, autoGenerate: Bool = false) {
        let value = initialInput ?? BirthInput()
        _input = State(initialValue: value)
        self.autoGenerate = autoGenerate
    }

    var body: some View {
        ScrollView {
            Group {
                if isWorking {
                    ReadingGenerationProgressView(kind: .selfReading, progress: progress)
                } else if let report {
                    VStack(alignment: .leading, spacing: 18) {
                        ReportView(report: report)
                        if let saveErrorMessage {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(saveErrorMessage).font(.footnote).foregroundStyle(FateTheme.danger)
                                Button("保存を再試行") { Task { await saveGeneratedReport() } }.buttonStyle(FLSecondaryButtonStyle())
                            }
                        }
                        Button("別の人を鑑定する") { resetForAnotherPerson() }
                            .buttonStyle(FLSecondaryButtonStyle())
                    }
                } else {
                    inputForm
                }
            }
            .padding(20)
        }
        .background(FateTheme.canvas)
        .toolbar(isWorking ? .hidden : .visible, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await APIClient.shared.warmup()
            if autoGenerate && !didAutoGenerate {
                didAutoGenerate = true
                await generateReport()
            }
        }
        .safeAreaInset(edge: .bottom) {
            if report == nil && !isWorking {
                VStack(spacing: 6) {
                    Button("あなたを読む") { Task { await generateReport() } }
                        .buttonStyle(FLPrimaryButtonStyle())
                    Text(AppConfig.requiresAuthentication ? "入力は約1分です" : "登録すると鑑定結果を保存できます・入力は約1分です")
                        .font(.system(size: 13))
                        .foregroundStyle(FateTheme.muted)
                }
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
                .background(FateTheme.canvas)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line), alignment: .top)
            }
        }
        .onChange(of: input) { _, _ in
            report = nil
            errorMessage = nil
        }
        .sheet(isPresented: $showDatePicker) { datePickerSheet }
        .sheet(isPresented: $showTimePicker) { timePickerSheet }
        .sheet(isPresented: $showBirthplacePicker) { birthplacePickerSheet }
        .sheet(isPresented: $showGenderPicker) { genderPickerSheet }
    }

    private var inputForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack { FateMark(size: 24); Text("FATE LAB").font(.system(size: 12, weight: .medium)).tracking(3); Spacer(); Image(systemName: "person.crop.circle").font(.title2).accessibilityLabel("プロフィール") }
            .padding(.bottom, 48)
            Text(input.nickname.isEmpty ? "あなた、" : "\(input.nickname)、").font(.system(size: 30, weight: .bold))
            Text("今日のあなた。").font(.system(size: 30, weight: .bold)).padding(.top, 2)
            Text("あなたのパターンを、\nまだ読んでいません。").font(.system(size: 34, weight: .bold)).lineSpacing(5).padding(.top, 44)
            Text("生まれたときの情報から、最初の鑑定を作ります。").font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(5).padding(.top, 18)
            VStack(alignment: .leading, spacing: 16) {
                Text("生年月日").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
                DateMenuPicker(date: $input.date)
                FLDivider()
                Text("出生時刻（任意）").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
                if input.birthTime == nil {
                    Button("時刻を入力する") {
                        draftTime = Calendar.current.date(from: DateComponents(hour: 12, minute: 0)) ?? Date()
                        showTimePicker = true
                    }
                    .buttonStyle(FLSecondaryButtonStyle())
                } else {
                    HStack {
                        Button(input.birthTime?.formatted(date: .omitted, time: .shortened) ?? "") {
                            draftTime = input.birthTime ?? Date()
                            showTimePicker = true
                        }
                        .foregroundStyle(FateTheme.ink)
                        Spacer()
                        Button("クリア") { input.birthTime = nil }
                            .font(.system(size: 14, weight: .semibold)).foregroundStyle(FateTheme.muted)
                    }.frame(minHeight: 44)
                }
                Text("分からない場合は空欄のまま鑑定できます").font(.footnote).foregroundStyle(FateTheme.muted)
                FLDivider()
                Text("出生地").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
                selectionRow(value: input.birthplace) { showBirthplacePicker = true }
                FLDivider()
                Text("性別").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
                selectionRow(value: input.gender == "male" ? "男性" : "女性") { showGenderPicker = true }
            }
            .padding(.top, 32)
            if let errorMessage {
                VStack(alignment: .leading, spacing: 12) {
                    Text(errorMessage).font(.footnote).foregroundStyle(FateTheme.danger)
                    Button("もう一度試す") { Task { await generateReport() } }.buttonStyle(FLSecondaryButtonStyle())
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.danger.opacity(0.45)))
            }
            Color.clear.frame(height: 104)
        }
    }

    private var formRule: some View { Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line) }

    private func selectionRow(value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(value).foregroundStyle(FateTheme.ink); Spacer(); Image(systemName: "chevron.right").foregroundStyle(FateTheme.muted) }
                .contentShape(Rectangle()).padding(.vertical, 6)
        }.buttonStyle(.plain)
    }

    private var birthplacePickerSheet: some View {
        NavigationStack {
            List(prefectures, id: \.self) { place in
                Button { input.birthplace = place; showBirthplacePicker = false } label: {
                    HStack { Text(place); Spacer(); if input.birthplace == place { Image(systemName: "checkmark") } }
                }.foregroundStyle(FateTheme.ink)
            }.scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("出生地")
        }.presentationDetents([.large])
    }

    private var genderPickerSheet: some View {
        NavigationStack {
            List {
                Button("女性") { input.gender = "female"; showGenderPicker = false }
                Button("男性") { input.gender = "male"; showGenderPicker = false }
            }.foregroundStyle(FateTheme.ink).scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("性別")
        }.presentationDetents([.medium])
    }

    private var datePickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("生年月日を選んでください")
                    .font(.system(size: 20, weight: .medium))
                DatePicker(
                    "生年月日",
                    selection: $draftDate,
                    in: Calendar.current.date(from: DateComponents(year: 1900, month: 1, day: 1))!...Date(),
                    displayedComponents: .date
                )
                .datePickerStyle(.wheel)
                .labelsHidden()
                .environment(\.locale, Locale(identifier: "ja_JP"))
                Button("この日付を使用する") {
                    input.date = draftDate
                    showDatePicker = false
                }.buttonStyle(FLPrimaryButtonStyle())
            }
            .padding(24)
            .background(FateTheme.canvas)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { showDatePicker = false } } }
        }
        .presentationDetents([.medium])
    }

    private var timePickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("正確な出生時刻を選んでください").font(.system(size: 20, weight: .medium))
                DatePicker("出生時刻", selection: $draftTime, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel).labelsHidden()
                Button("この時刻を使用する") {
                    input.birthTime = draftTime; showTimePicker = false
                }.buttonStyle(FLPrimaryButtonStyle())
            }.padding(24).background(FateTheme.canvas)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { showTimePicker = false } } }
        }.presentationDetents([.medium])
    }

    private func generateReport() async {
        let requestedInput = input
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            var generated = try await APIClient.shared.generateReport(input: requestedInput, auth: auth) { progress = $0 }
            if input == requestedInput {
                report = generated
                if auth.session != nil {
                    do {
                        generated.conversationID = try await APIClient.shared.createConversation(report: generated, auth: auth)
                        report = generated
                        saveErrorMessage = nil
                    } catch {
                        saveErrorMessage = userFacingMessage(error) ?? ""
                    }
                }
            }
        }
        catch { report = nil; errorMessage = userFacingMessage(error) }
    }

    private func saveGeneratedReport() async {
        guard var current = report, current.conversationID == nil, auth.session != nil else { return }
        do {
            current.conversationID = try await APIClient.shared.createConversation(report: current, auth: auth)
            report = current
            saveErrorMessage = nil
        } catch { saveErrorMessage = userFacingMessage(error) }
    }

    private func resetForAnotherPerson() {
        input = BirthInput()
        report = nil
        errorMessage = nil
        saveErrorMessage = nil
    }

    @ViewBuilder private func inputSection<Content: View>(_ number: String, _ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(number).font(.caption2).foregroundStyle(FateTheme.ink)
                Text(title).font(.system(size: 16, weight: .semibold))
            }
            content()
        }
    }

}

private struct FateLoadingView: View {
    let progress: GenerationProgress

    var body: some View {
            VStack(spacing: 30) {
                Spacer()
                FateMark(size: 72)
                Text("あなたのパターンを読んでいます").font(.system(size: 20, weight: .semibold))
                Text("\(progress.percent)%").font(.system(size: 42, weight: .bold))
                ProgressView(value: Double(progress.percent), total: 100).tint(FateTheme.ink)

                VStack(spacing: 12) {
                    Text(progress.title)
                        .font(.system(size: 26, weight: .medium))
                        .multilineTextAlignment(.center)
                    Text(progress.detail)
                        .font(.system(size: 15))
                        .foregroundStyle(FateTheme.muted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(progress.percent)パーセント。\(progress.title)。\(progress.detail)")
    }

}

private struct LoadingArc: View {
    @State private var rotating = false
    var body: some View {
        Circle().trim(from: 0.08, to: 0.72)
            .stroke(FateTheme.ink, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            .frame(width: 32, height: 32).rotationEffect(.degrees(rotating ? 360 : 0))
            .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: rotating)
            .onAppear { rotating = true }
    }
}

struct ReportView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    @EnvironmentObject private var tabRouter: AppTabRouter
    let report: GeneratedReport
    @State private var isSaving = false
    @State private var pendingAfterAuth = false
    @State private var pendingContextTitle: String?
    @State private var errorMessage: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Divider().overlay(FateTheme.line)
            InsightHubView(report: report) { card in
                if auth.session == nil {
                    pendingAfterAuth = true
                    pendingContextTitle = card.title
                    AuthPresentation.shared.isPresented = true
                } else { Task { await saveAndOpen(contextTitle: card.title) } }
            }
            if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            Text("結果は将来を保証するものではありません。重要な意思決定はご自身で判断してください。")
                .font(.caption).foregroundStyle(FateTheme.muted)
        }
        .onChange(of: auth.session?.user.id) { _, userID in
            if userID != nil && pendingAfterAuth {
                pendingAfterAuth = false
                Task { await saveAndOpen(contextTitle: pendingContextTitle) }
            }
        }
    }

    private func saveAndOpen(contextTitle: String? = nil) async {
        guard auth.session != nil else { return }
        isSaving = true; errorMessage = nil
        do {
            let conversationID = if let existing = report.conversationID { existing } else { try await APIClient.shared.createConversation(report: report, auth: auth) }
            tabRouter.openChat(conversationID: conversationID, contextTitle: contextTitle)
        }
        catch { errorMessage = userFacingMessage(error) }
        isSaving = false
    }
}
