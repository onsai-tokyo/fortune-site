import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input = BirthInput()
    @State private var report: GeneratedReport?
    @State private var isWorking = false
    @State private var progress: ReportProgress = .calculating
    @State private var timeSelected = false
    @State private var showDatePicker = false
    @State private var draftDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var showTimePicker = false
    @State private var draftTime = Calendar.current.date(from: DateComponents(hour: 12, minute: 0)) ?? Date()
    @State private var errorMessage: String?
    private let prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("FATE LAB").font(.system(size: 17, weight: .medium, design: .serif)).tracking(4)
                Text("9つの占術を、\n4つの系統から照合。")
                    .font(.system(size: 34, weight: .medium, design: .serif)).lineSpacing(6)
                Text("重なって現れた傾向を中心に、同じ入力なら変わらない鑑定書を作成します。")
                    .foregroundStyle(FateTheme.muted).lineSpacing(6)
                ReportCard {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("INSTANT ANALYSIS").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                        inputSection("01", "生年月日") {
                            Button {
                                draftDate = input.date
                                showDatePicker = true
                            } label: {
                                HStack {
                                    Text(input.date.formatted(.dateTime.year().month(.twoDigits).day(.twoDigits)))
                                    Spacer()
                                    Text("生年月日を選ぶ")
                                    Image(systemName: "chevron.right")
                                }
                                .padding(12)
                                .foregroundStyle(FateTheme.ink)
                                .background(FateTheme.paper)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(FateTheme.line))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        Divider().overlay(FateTheme.line.opacity(0.7))
                        inputSection("02", "出生時刻") {
                            Toggle("時刻を入力する", isOn: $input.hasTime)
                            if input.hasTime {
                                Button {
                                    showTimePicker = true
                                } label: {
                                    HStack {
                                        Text(timeSelected ? input.time.formatted(date: .omitted, time: .shortened) : "--:--")
                                        Spacer(); Text("出生時刻を選ぶ"); Image(systemName: "chevron.right")
                                    }.padding(12).foregroundStyle(timeSelected ? FateTheme.ink : FateTheme.gold)
                                        .background(FateTheme.paper)
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(FateTheme.line))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                            Text("不明でも鑑定できます。一部の占術は時刻があると、より詳しく計算できます。")
                                .font(.caption).foregroundStyle(FateTheme.muted)
                        }
                        Divider().overlay(FateTheme.line.opacity(0.7))
                        inputSection("03", "出生地（都道府県）") {
                            Picker("都道府県", selection: $input.birthplace) { ForEach(prefectures, id: \.self) { Text($0) } }
                        }
                        Divider().overlay(FateTheme.line.opacity(0.7))
                        inputSection("04", "性別") {
                            Picker("性別", selection: $input.gender) {
                                Text("女性").tag("female"); Text("男性").tag("male")
                            }.pickerStyle(.segmented).labelsHidden()
                        }
                        if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
                        if isWorking { progressView }
                    }
                }
                if let report {
                    Button("別の人を鑑定する") { resetForAnotherPerson() }
                        .buttonStyle(.bordered)
                        .tint(FateTheme.gold)
                        .frame(maxWidth: .infinity)
                    ReportView(report: report)
                }
            }.padding(20)
        }.background(FateTheme.ivory).navigationBarTitleDisplayMode(.inline)
            .task { await APIClient.shared.warmup() }
            .safeAreaInset(edge: .bottom) {
                if report == nil {
                    VStack(spacing: 6) {
                        Button(isWorking ? "鑑定中です" : "今すぐ鑑定する") {
                            Task { await generateReport() }
                        }
                        .buttonStyle(GoldButtonStyle())
                        .disabled(isWorking || (input.hasTime && !timeSelected))
                        .opacity(input.hasTime && !timeSelected ? 0.5 : 1)
                        Text("登録不要・約1分")
                            .font(.system(size: 13))
                            .foregroundStyle(FateTheme.muted)
                    }
                    .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
                    .background(.regularMaterial)
                }
            }
            .onChange(of: input.hasTime) { _, enabled in
                if enabled { timeSelected = false; showTimePicker = true }
            }
            .onChange(of: input) { _, _ in
                // 入力と一致しない古い鑑定書を画面に残さない。
                report = nil
                errorMessage = nil
            }
            .sheet(isPresented: $showDatePicker) {
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
            .sheet(isPresented: $showTimePicker) {
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
    }

    private func generateReport() async {
        let requestedInput = input
        isWorking = true; errorMessage = nil
        do {
            let generated = try await APIClient.shared.generateReport(input: requestedInput) { progress = $0 }
            if input == requestedInput { report = generated }
        }
        catch { errorMessage = error.localizedDescription }
        isWorking = false
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

    private var progressView: some View {
        HStack(spacing: 12) {
            ProgressView().tint(FateTheme.gold)
            VStack(alignment: .leading, spacing: 3) {
                Text(progress == .calculating ? "命式を計算しています" : "9つの結果を照らし合わせています")
                    .font(.system(size: 15, weight: .semibold))
                Text(progress == .calculating ? "入力内容から各占術の結果を算出中です。" : "共通して現れる傾向をまとめています。")
                    .font(.caption).foregroundStyle(FateTheme.muted)
            }
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.gold.opacity(0.08)).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct ReportView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var purchases: PurchaseManager
    let report: GeneratedReport
    @State private var conversationID: UUID?
    @State private var isSaving = false
    @State private var pendingAfterAuth = false
    @State private var errorMessage: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Divider().overlay(FateTheme.line)
            ReportDocumentView(report: report, questionTitle: questionButtonTitle, isSaving: isSaving) {
                if auth.session == nil {
                    pendingAfterAuth = true
                    AuthPresentation.shared.isPresented = true
                } else { Task { await saveAndOpen() } }
            }
            if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            Text("結果は将来を保証するものではありません。重要な意思決定はご自身で判断してください。")
                .font(.caption).foregroundStyle(FateTheme.muted)
        }
        .navigationDestination(item: $conversationID) { ReadingChatView(conversationID: $0) }
        .onChange(of: auth.session?.user.id) { _, userID in
            if userID != nil && pendingAfterAuth {
                pendingAfterAuth = false
                Task { await saveAndOpen() }
            }
        }
    }

    private var questionButtonTitle: String {
        purchases.isPremium ? "この結果について質問する" : "この結果について質問する（無料）"
    }

    private func saveAndOpen() async {
        guard let token = auth.session?.accessToken else { return }
        isSaving = true; errorMessage = nil
        do { conversationID = try await APIClient.shared.createConversation(report: report, token: token) }
        catch { errorMessage = error.localizedDescription }
        isSaving = false
    }
}
