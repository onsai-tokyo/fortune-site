import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var input: BirthInput
    @State private var report: GeneratedReport?
    @State private var isWorking = false
    @State private var progress = GenerationProgress.preparing
    @State private var errorMessage: String?
    @State private var saveErrorMessage: String?
    private let autoGenerate: Bool
    private let initialDraftNeeded: Bool
    private var draftKey: String { AccountStorage.key("reading.draft", userID: auth.userID) }
    @State private var didAutoGenerate = false

    init(initialInput: BirthInput? = nil, autoGenerate: Bool = false) {
        let value = initialInput ?? BirthInput()
        _input = State(initialValue: value)
        self.autoGenerate = autoGenerate
        self.initialDraftNeeded = initialInput == nil
    }

    var body: some View {
        Group {
            if isWorking {
                ReadingGenerationProgressView(kind: .selfReading, progress: progress)
            } else {
            ReadingScrollView {
            Group {
                if let report {
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
            }
        }
        .background(FateTheme.canvas)
        .toolbar(isWorking ? .hidden : .visible, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .task { await APIClient.shared.warmup() }
        .task {
            do {
                if let pending = try APIClient.shared.pendingReport(auth: auth) {
                    report = pending
                    didAutoGenerate = true
                    saveErrorMessage = "生成済みの鑑定を復旧しました。保存を再試行してください"
                    return
                }
            } catch {
                errorMessage = userFacingMessage(error)
                didAutoGenerate = true
                return
            }
            if initialDraftNeeded, let data = UserDefaults.standard.data(forKey: draftKey),
               let draft = try? JSONDecoder().decode(BirthInput.self, from: data) { input = draft }
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
                        .font(.system(.caption))
                        .foregroundStyle(FateTheme.muted)
                }
                .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 8)
                .background(FateTheme.canvas)
                .overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line), alignment: .top)
            }
        }
        .onChange(of: report?.conversationID) { _, id in
            if let id { UserDefaults.standard.set(id.uuidString, forKey: AccountStorage.key("landing.lastConversationID", userID: auth.userID)) }
        }
        .onChange(of: input) { _, _ in
            if let data = try? JSONEncoder().encode(input) { UserDefaults.standard.set(data, forKey: draftKey) }
            if report?.conversationID != nil { report = nil }
            errorMessage = nil
        }
    }

    private var inputForm: some View {
        VStack(alignment: .center, spacing: 0) {
            FateEditorialHero(eyebrow: "YOUR STORY", title: "あなたを読み解く", subtitle: "生まれたときの情報から、最初の鑑定を作ります。")
            BirthProfileFields(date: $input.date, birthTime: $input.birthTime, birthplace: $input.birthplace, gender: $input.gender)
            RelationshipStatusFields(value: $input.relationshipStatus)
            .padding(20).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20)).padding(.top, 24).frame(maxWidth: 520)
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
        guard !isWorking else { return }
        let owner = AccountScope(auth)
        let requestedInput = input
        if let data = try? JSONEncoder().encode(input) { UserDefaults.standard.set(data, forKey: draftKey) }
        progress = .preparing
        isWorking = true; errorMessage = nil
        defer { if owner.isCurrent(auth) { isWorking = false } }
        do {
            var generated = try await APIClient.shared.generateReport(input: requestedInput, auth: auth) { if owner.isCurrent(auth) { progress = $0 } }
            try owner.check(auth)
            if input == requestedInput {
                report = generated
                if auth.session != nil {
                    do {
                        generated.conversationID = try await APIClient.shared.createConversation(report: generated, auth: auth)
                        try owner.check(auth)
                        report = generated
                        UserDefaults.standard.removeObject(forKey: AccountStorage.key("onboarding.draft", userID: owner.userID))
                        saveErrorMessage = nil
                    } catch {
                        guard owner.isCurrent(auth) else { return }
                        handleSaveError(error)
                    }
                }
            }
        }
        catch { guard owner.isCurrent(auth) else { return }; report = nil; errorMessage = userFacingMessage(error) }
    }

    private func saveGeneratedReport() async {
        let owner = AccountScope(auth)
        guard var current = report, current.conversationID == nil, auth.session != nil else { return }
        do {
            current.conversationID = try await APIClient.shared.createConversation(report: current, auth: auth)
            try owner.check(auth)
            report = current
            saveErrorMessage = nil
        } catch { guard owner.isCurrent(auth) else { return }; handleSaveError(error) }
    }

    private func handleSaveError(_ error: Error) {
        if case APIError.http(status: 410, message: _) = error {
            report = nil; saveErrorMessage = nil
            errorMessage = "この鑑定は削除されています。新しく鑑定する場合は入力内容を確認してください"
        } else { saveErrorMessage = userFacingMessage(error) }
    }

    private func resetForAnotherPerson() {
        if report?.conversationID == nil {
            saveErrorMessage = "先にこの鑑定の保存を完了してください"
            return
        }
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
    @State private var pendingCard: ReadingCard?
    @State private var errorMessage: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Divider().overlay(FateTheme.line)
            InsightHubView(report: report) { card in
                if auth.session == nil {
                    pendingAfterAuth = true
                    pendingCard = card
                    AuthPresentation.shared.isPresented = true
                } else { Task { await saveAndOpen(card: card) } }
            }
            if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            Text("結果は将来を保証するものではありません。重要な意思決定はご自身で判断してください。")
                .font(.caption).foregroundStyle(FateTheme.muted)
        }
        .onChange(of: auth.session?.user.id) { _, userID in
            if userID != nil && pendingAfterAuth {
                pendingAfterAuth = false
                let card = pendingCard; pendingCard = nil
                Task { await saveAndOpen(card: card) }
            }
        }
    }

    private func saveAndOpen(card: ReadingCard? = nil) async {
        let owner = AccountScope(auth)
        guard auth.session != nil, !isSaving else { return }
        isSaving = true; errorMessage = nil
        do {
            let conversationID = if let existing = report.conversationID { existing } else { try await APIClient.shared.createConversation(report: report, auth: auth) }
            try owner.check(auth)
            tabRouter.openBook(conversationID: conversationID, card: card)
        }
        catch { guard owner.isCurrent(auth) else { return }; errorMessage = userFacingMessage(error) }
        isSaving = false
    }
}
