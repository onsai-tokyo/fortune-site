import SwiftUI

struct OnboardingView: View {
    @AppStorage("fatelab.onboarding.step") private var storedStep = 1
    @AppStorage("fatelab.onboarding.draft") private var storedDraft = ""
    @State private var step = 1
    @State private var input = BirthInput()
    @State private var acceptedTerms = false
    let onComplete: (BirthInput) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView { content.padding(.top, 40).padding(.bottom, 120) }
            footer
        }
        .padding(.horizontal, 24).background(FateTheme.canvas.ignoresSafeArea())
        .onAppear { restoreDraft() }
        .onChange(of: step) { _, value in storedStep = value }
        .onChange(of: input) { _, _ in saveDraft() }
        .animation(.easeInOut(duration: 0.22), value: step)
    }

    private var header: some View {
        VStack(spacing: 14) {
            HStack {
                Button { if step > 1 { step -= 1 } } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .foregroundStyle(FateTheme.ink).opacity(step == 1 ? 0 : 1).disabled(step == 1).accessibilityLabel("前へ戻る")
                Spacer(); Text("\(step) / 6").font(.system(size: 11, weight: .medium)).foregroundStyle(FateTheme.muted)
            }
            FLProgressIndicator(current: step, total: 6)
        }.padding(.top, 8)
    }

    @ViewBuilder private var content: some View {
        switch step {
        case 1:
            question("なんとお呼びすればよいですか？", detail: "鑑定の中で使う呼び名です。あとから変更できます。") {
                TextField("呼び名", text: $input.nickname).font(.system(size: 28, weight: .semibold)).textFieldStyle(.plain).padding(.vertical, 14); FLDivider()
                FLTextLink(title: "あとで設定する") { input.nickname = ""; step += 1 }
            }
        case 2:
            question("生まれた日を教えてください。", detail: "あなたのパターンを読むために使います。") {
                DatePicker("生年月日", selection: $input.date, in: Calendar.current.date(from: DateComponents(year: 1900, month: 1, day: 1))!...Date(), displayedComponents: .date).datePickerStyle(.wheel).labelsHidden().environment(\.locale, Locale(identifier: "ja_JP"))
            }
        case 3:
            question("生まれた時間はわかりますか？", detail: "わからなくても、鑑定はできます。") {
                HStack { FLChip(title: "わかる", selected: input.hasTime) { input.hasTime = true }; FLChip(title: "わからない", selected: !input.hasTime) { input.hasTime = false } }
                if input.hasTime { DatePicker("出生時刻", selection: $input.time, displayedComponents: .hourAndMinute).datePickerStyle(.wheel).labelsHidden() }
            }
        case 4:
            question("生まれた場所を教えてください。", detail: "都道府県を選んでください。") {
                Picker("出生地", selection: $input.birthplace) { ForEach(Self.prefectures, id: \.self) { Text($0) } }.pickerStyle(.wheel)
            }
        case 5:
            question("鑑定に必要な情報を教えてください。", detail: "計算に使用し、設定からあとで変更できます。") {
                Picker("性別", selection: $input.gender) { Text("女性").tag("female"); Text("男性").tag("male") }.pickerStyle(.segmented)
            }
        default:
            question("これで、あなたのパターンを読みます。", detail: "内容は設定からいつでも変更できます。") {
                VStack(spacing: 0) {
                    ReviewRow(label: "呼び名", value: input.nickname.isEmpty ? "未設定" : input.nickname)
                    ReviewRow(label: "生年月日", value: input.date.formatted(.dateTime.year().month().day()))
                    ReviewRow(label: "出生時刻", value: input.hasTime ? input.time.formatted(date: .omitted, time: .shortened) : "不明")
                    ReviewRow(label: "出生地", value: input.birthplace)
                    ReviewRow(label: "性別", value: input.gender == "female" ? "女性" : "男性", divider: false)
                }.overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
                Toggle("利用規約とプライバシーポリシーに同意します", isOn: $acceptedTerms).font(.footnote).tint(FateTheme.ink)
            }
        }
    }

    private func question<Content: View>(_ title: String, detail: String, @ViewBuilder fields: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 24) { Text(title).font(.system(size: 30, weight: .bold)).foregroundStyle(FateTheme.ink).fixedSize(horizontal: false, vertical: true); Text(detail).font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(5); fields() }.transition(.opacity.combined(with: .move(edge: .trailing)))
    }

    private var footer: some View {
        Button(step == 6 ? "あなたを読む" : "次へ") {
            if step < 6 { step += 1 } else { storedStep = 1; storedDraft = ""; onComplete(input) }
        }.buttonStyle(FLPrimaryButtonStyle()).disabled(step == 6 && !acceptedTerms).opacity(step == 6 && !acceptedTerms ? 0.4 : 1).padding(.vertical, 12).background(FateTheme.canvas)
    }

    private func saveDraft() { if let data = try? JSONEncoder().encode(input) { storedDraft = data.base64EncodedString() } }
    private func restoreDraft() { step = min(max(storedStep, 1), 6); if let data = Data(base64Encoded: storedDraft), let value = try? JSONDecoder().decode(BirthInput.self, from: data) { input = value } }
    static let prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]
}

private struct ReviewRow: View { let label: String; let value: String; var divider = true; var body: some View { VStack(spacing: 0) { HStack { Text(label).foregroundStyle(FateTheme.muted); Spacer(); Text(value).fontWeight(.semibold) }.padding(16); if divider { FLDivider().padding(.leading, 16) } } } }
