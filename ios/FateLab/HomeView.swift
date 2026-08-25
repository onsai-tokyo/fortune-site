import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input: BirthInput
    @State private var report: GeneratedReport?
    @State private var isWorking = false
    @State private var progress = GenerationProgress(percent: 5, title: "入力内容を確認しています", detail: "生年月日と出生地を確認しています")
    @State private var errorMessage: String?
    @State private var saveErrorMessage: String?
    private let autoGenerate: Bool
    @State private var didAutoGenerate = false

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
    }

    private var inputForm: some View {
        VStack(alignment: .center, spacing: 0) {
            Text("鑑定する").font(.system(size: 30, weight: .bold)).padding(.top, 8)
            Text("生まれたときの情報から、最初の鑑定を作ります。").font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(5).padding(.top, 18)
            BirthProfileFields(date: $input.date, birthTime: $input.birthTime, birthplace: $input.birthplace, gender: $input.gender)
            .padding(.top, 32).frame(maxWidth: 520)
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
