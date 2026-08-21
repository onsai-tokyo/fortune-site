import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input: BirthInput
    @State private var report: GeneratedReport?
    @State private var isWorking = false
    @State private var progress: ReportProgress = .calculating
    @State private var timeSelected = false
    @State private var showDatePicker = false
    @State private var draftDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var showTimePicker = false
    @State private var showTimeKnowledge = false
    @State private var showBirthplacePicker = false
    @State private var showGenderPicker = false
    @State private var draftTime = Calendar.current.date(from: DateComponents(hour: 12, minute: 0)) ?? Date()
    @State private var errorMessage: String?
    private let autoGenerate: Bool
    @State private var didAutoGenerate = false
    private let prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]

    init(initialInput: BirthInput? = nil, autoGenerate: Bool = false) {
        let value = initialInput ?? BirthInput()
        _input = State(initialValue: value)
        _timeSelected = State(initialValue: value.hasTime)
        self.autoGenerate = autoGenerate
    }

    var body: some View {
        ScrollView {
            Group {
                if isWorking {
                    FateLoadingView(progress: progress)
                } else if let report {
                    VStack(alignment: .leading, spacing: 18) {
                        ReportView(report: report)
                        Button("別の人を鑑定する") { resetForAnotherPerson() }
                            .buttonStyle(OutlineGoldButtonStyle())
                    }
                } else {
                    inputForm
                }
            }
            .padding(20)
        }
        .background(FateTheme.ivory)
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
                    Button("無料鑑定をはじめる") { Task { await generateReport() } }
                        .buttonStyle(GoldButtonStyle())
                        .disabled(input.hasTime && !timeSelected)
                        .opacity(input.hasTime && !timeSelected ? 0.5 : 1)
                    Text(AppConfig.requiresAuthentication ? "入力は約1分です" : "登録すると鑑定結果を保存できます・入力は約1分です")
                        .font(.system(size: 13))
                        .foregroundStyle(FateTheme.muted)
                }
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
                .background(FateTheme.background)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.border), alignment: .top)
            }
        }
        .onChange(of: input) { _, _ in
            report = nil
            errorMessage = nil
        }
        .sheet(isPresented: $showDatePicker) { datePickerSheet }
        .sheet(isPresented: $showTimeKnowledge) { timeKnowledgeSheet }
        .sheet(isPresented: $showTimePicker) { timePickerSheet }
        .sheet(isPresented: $showBirthplacePicker) { birthplacePickerSheet }
        .sheet(isPresented: $showGenderPicker) { genderPickerSheet }
    }

    private var inputForm: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("FATE LAB").font(.system(size: 17, weight: .medium, design: .serif)).tracking(1)
            Text("占いを重ねると、\nあなたの輪郭が見えてくる。")
                .font(.system(size: 29, weight: .medium, design: .serif)).lineSpacing(13)
            Text("東洋と西洋、9つの占術を横断し、\n共通して現れる傾向だけを読み解きます。")
                .foregroundStyle(FateTheme.muted).lineSpacing(6)
            if let errorMessage {
                VStack(alignment: .leading, spacing: 12) {
                    Text(errorMessage).font(.footnote).foregroundStyle(FateTheme.destructive)
                    Button("もう一度試す") { Task { await generateReport() } }.buttonStyle(OutlineGoldButtonStyle())
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(FateTheme.destructive.opacity(0.45)))
            }
            VStack(alignment: .leading, spacing: 18) {
                inputSection("01", "生年月日") { DateMenuPicker(date: $input.date) }
                formRule
                inputSection("02", "出生時刻") {
                    selectionRow(value: input.hasTime && timeSelected ? input.time.formatted(date: .omitted, time: .shortened) : "未入力") { showTimeKnowledge = true }
                    Text("時刻が不明でも鑑定できます").font(.caption).foregroundStyle(FateTheme.muted)
                }
                formRule
                inputSection("03", "出生地") {
                    selectionRow(value: input.birthplace) { showBirthplacePicker = true }
                }
                formRule
                inputSection("04", "性別") {
                    selectionRow(value: input.gender == "male" ? "男性" : "女性") { showGenderPicker = true }
                }
            }
            Color.clear.frame(height: 104)
        }
    }

    private var formRule: some View { Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.border) }

    private func selectionRow(value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(value).foregroundStyle(FateTheme.primaryText); Spacer(); Image(systemName: "chevron.right").foregroundStyle(FateTheme.secondaryText) }
                .contentShape(Rectangle()).padding(.vertical, 6)
        }.buttonStyle(.plain)
    }

    private var timeKnowledgeSheet: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Button("出生時刻がわかる") { showTimeKnowledge = false; input.hasTime = true; showTimePicker = true }
                    .buttonStyle(OutlineGoldButtonStyle())
                Button("出生時刻はわからない") { input.hasTime = false; timeSelected = false; showTimeKnowledge = false }
                    .buttonStyle(OutlineGoldButtonStyle())
            }.padding(24).background(FateTheme.ivory).fateScreenTitle("出生時刻")
        }.presentationDetents([.medium])
    }

    private var birthplacePickerSheet: some View {
        NavigationStack {
            List(prefectures, id: \.self) { place in
                Button { input.birthplace = place; showBirthplacePicker = false } label: {
                    HStack { Text(place); Spacer(); if input.birthplace == place { Image(systemName: "checkmark") } }
                }.foregroundStyle(FateTheme.primaryText)
            }.scrollContentBackground(.hidden).background(FateTheme.ivory).fateScreenTitle("出生地")
        }.presentationDetents([.large])
    }

    private var genderPickerSheet: some View {
        NavigationStack {
            List {
                Button("女性") { input.gender = "female"; showGenderPicker = false }
                Button("男性") { input.gender = "male"; showGenderPicker = false }
            }.foregroundStyle(FateTheme.primaryText).scrollContentBackground(.hidden).background(FateTheme.ivory).fateScreenTitle("性別")
        }.presentationDetents([.medium])
    }

    private var datePickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("生年月日を選んでください")
                    .font(.system(size: 20, weight: .medium, design: .serif))
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
                }.buttonStyle(GoldButtonStyle())
            }
            .padding(24)
            .background(FateTheme.ivory)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { showDatePicker = false } } }
        }
        .presentationDetents([.medium])
    }

    private var timePickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("正確な出生時刻を選んでください").font(.system(size: 20, weight: .medium, design: .serif))
                DatePicker("出生時刻", selection: $draftTime, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel).labelsHidden()
                Button("この時刻を使用する") {
                    input.time = draftTime; timeSelected = true; showTimePicker = false
                }.buttonStyle(GoldButtonStyle())
            }.padding(24).background(FateTheme.ivory)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("キャンセル") { input.hasTime = false; showTimePicker = false } } }
        }.presentationDetents([.medium])
    }

    private func generateReport() async {
        let requestedInput = input
        isWorking = true; errorMessage = nil
        defer { isWorking = false }
        do {
            let generated = try await APIClient.shared.generateReport(input: requestedInput, auth: auth) { progress = $0 }
            if input == requestedInput { report = generated }
        }
        catch { report = nil; errorMessage = userFacingMessage(error) }
    }

    private func resetForAnotherPerson() {
        input = BirthInput()
        timeSelected = false
        report = nil
        errorMessage = nil
    }

    @ViewBuilder private func inputSection<Content: View>(_ number: String, _ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(number).font(.caption2).foregroundStyle(FateTheme.gold)
                Text(title).font(.system(size: 16, weight: .semibold))
            }
            content()
        }
    }

}

private struct FateLoadingView: View {
    let progress: ReportProgress

    var body: some View {
            VStack(spacing: 30) {
                Spacer()
                LoadingArc()

                VStack(spacing: 12) {
                    Text(progress == .calculating ? "あなたの命式を計算しています" : "鑑定書をまとめています")
                        .font(.system(size: 26, weight: .medium, design: .serif))
                        .multilineTextAlignment(.center)
                    Text(progress == .calculating
                         ? "生年月日・出生時刻・出生地から、\nそれぞれの結果を算出しています。"
                         : "重なって現れた傾向を読み取り、\nあなたの鑑定へ整えています。")
                        .font(.system(size: 15))
                        .foregroundStyle(FateTheme.muted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(progress == .calculating ? "あなたの命式を計算しています" : "鑑定書をまとめています")
    }

}

private struct LoadingArc: View {
    @State private var rotating = false
    var body: some View {
        Circle().trim(from: 0.08, to: 0.72)
            .stroke(FateTheme.accent, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
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
            let conversationID = try await APIClient.shared.createConversation(report: report, auth: auth)
            tabRouter.openChat(conversationID: conversationID, contextTitle: contextTitle)
        }
        catch { errorMessage = userFacingMessage(error) }
        isSaving = false
    }
}
