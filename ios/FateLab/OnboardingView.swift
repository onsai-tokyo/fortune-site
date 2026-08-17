import SwiftUI
import UserNotifications

struct OnboardingView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var page = 0
    @State private var input = BirthInput()
    @State private var timeSelected = false
    @State private var acceptedTerms = false
    let onComplete: (BirthInput) -> Void

    var body: some View {
        ZStack {
            FateTheme.ivory.ignoresSafeArea()
            Group {
                switch page {
                case 0: welcome
                case 1: introduction
                case 2: birthDetails
                case 3: placeAndGender
                case 4: notification
                default: review
                }
            }
            .transition(.opacity.combined(with: .move(edge: .trailing)))
        }
        .animation(.easeInOut(duration: 0.25), value: page)
    }

    private var welcome: some View {
        VStack(spacing: 0) {
            Spacer()
            FateMark(size: 112)
            Text("FATE LAB").font(.system(size: 22, weight: .medium, design: .serif)).tracking(7).padding(.top, 24)
            Text("生まれた瞬間から、\nあなたの流れを読み解く。")
                .font(.system(size: 30, weight: .medium, design: .serif)).multilineTextAlignment(.center).lineSpacing(8).padding(.top, 30)
            Spacer()
            Button("無料で鑑定をはじめる") { page = 1 }.buttonStyle(GoldButtonStyle())
            Button("新規登録（無料）") { AuthPresentation.shared.isPresented = true }.buttonStyle(OutlineGoldButtonStyle()).padding(.top, 12)
            Button("ログイン") { AuthPresentation.shared.isPresented = true }.font(.system(size: 16, weight: .semibold)).foregroundStyle(FateTheme.gold).padding(.vertical, 18)
            HStack(spacing: 18) { Link("利用規約", destination: URL(string: "https://fate-lab.com/terms")!); Link("プライバシー", destination: URL(string: "https://fate-lab.com/privacy")!) }
                .font(.caption).foregroundStyle(FateTheme.muted)
        }.padding(.horizontal, 28).padding(.bottom, 22)
    }

    private var introduction: some View {
        OnboardingScaffold(page: 1, onBack: { page -= 1 }) {
            Text("9つの占術を、\n4つの系統から照合。")
                .font(.system(size: 34, weight: .medium, design: .serif)).lineSpacing(7)
            Text("ひとつの見方に偏らず、重なって現れた傾向から、あなたの命式鑑定書を作ります。")
                .foregroundStyle(FateTheme.muted).lineSpacing(6)
            VStack(spacing: 12) {
                FeatureRow(number: "01", title: "生まれ持った本質", text: "考え方や人との関わり方を読み解きます。")
                FeatureRow(number: "02", title: "仕事・恋愛・人間関係", text: "暮らしの中で表れやすい傾向を整理します。")
                FeatureRow(number: "03", title: "過去とこれからの流れ", text: "転換しやすい時期を長い目で見渡します。")
            }
            Spacer()
            Button("出生情報を入力する") { page += 1 }.buttonStyle(GoldButtonStyle())
        }
    }

    private var birthDetails: some View {
        OnboardingScaffold(page: 2, onBack: { page -= 1 }) {
            Text("生まれた日と時刻を\n教えてください。").font(.system(size: 31, weight: .medium, design: .serif)).lineSpacing(7)
            Text("出生時刻が分からなくても鑑定できます。後から変更できます。")
                .foregroundStyle(FateTheme.muted).lineSpacing(5)
            VStack(alignment: .leading, spacing: 12) {
                Text("生年月日").font(.caption).foregroundStyle(FateTheme.gold)
                DatePicker("生年月日", selection: $input.date, in: Calendar.current.date(from: DateComponents(year: 1900, month: 1, day: 1))!...Date(), displayedComponents: .date)
                    .datePickerStyle(.compact).labelsHidden().environment(\.locale, Locale(identifier: "ja_JP"))
                Divider()
                Toggle("出生時刻を入力する", isOn: $input.hasTime).tint(FateTheme.gold)
                if input.hasTime {
                    DatePicker("出生時刻", selection: $input.time, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.compact).onChange(of: input.time) { _, _ in timeSelected = true }
                }
            }.padding(20).background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
            Spacer()
            Button("次へ") { page += 1 }.buttonStyle(GoldButtonStyle())
        }
    }

    private var placeAndGender: some View {
        OnboardingScaffold(page: 3, onBack: { page -= 1 }) {
            Text("出生地と性別を\n教えてください。")
                .font(.system(size: 31, weight: .medium, design: .serif)).lineSpacing(7)
            VStack(alignment: .leading, spacing: 18) {
                Text("出生地（都道府県）").font(.caption).foregroundStyle(FateTheme.gold)
                Picker("出生地", selection: $input.birthplace) {
                    ForEach(Self.prefectures, id: \.self) { Text($0) }
                }.pickerStyle(.menu).tint(FateTheme.ink)
                Divider()
                Text("性別").font(.caption).foregroundStyle(FateTheme.gold)
                Picker("性別", selection: $input.gender) { Text("女性").tag("female"); Text("男性").tag("male") }
                    .pickerStyle(.segmented)
            }.padding(20).background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
            Spacer()
            Button("次へ") { page += 1 }.buttonStyle(GoldButtonStyle())
        }
    }

    private var notification: some View {
        OnboardingScaffold(page: 4, onBack: { page -= 1 }) {
            Text("大切な流れを、\n見逃さないために。")
                .font(.system(size: 31, weight: .medium, design: .serif)).lineSpacing(7)
            Text("鑑定書の保存や大切なお知らせを受け取れます。通知は設定からいつでも変更できます。")
                .foregroundStyle(FateTheme.muted).lineSpacing(5)
            LockScreenNotificationPreview().padding(.vertical, 4)
            Spacer()
            Button("通知を許可してはじめる") {
                Task {
                    _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                    page += 1
                }
            }.buttonStyle(GoldButtonStyle())
            Button("今はしない") { page += 1 }.font(.system(size: 16, weight: .semibold)).foregroundStyle(FateTheme.gold).frame(maxWidth: .infinity).padding(.top, 8)
        }
    }

    private var review: some View {
        OnboardingScaffold(page: 5, onBack: { page -= 1 }) {
            Text("入力内容を\n確認してください。")
                .font(.system(size: 31, weight: .medium, design: .serif)).lineSpacing(7)
            VStack(spacing: 0) {
                ReviewRow(label: "生年月日", value: input.date.formatted(.dateTime.year().month().day()))
                ReviewRow(label: "出生時刻", value: input.hasTime ? input.time.formatted(date: .omitted, time: .shortened) : "不明")
                ReviewRow(label: "出生地", value: input.birthplace)
                ReviewRow(label: "性別", value: input.gender == "female" ? "女性" : "男性", divider: false)
            }.background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
            Toggle(isOn: $acceptedTerms) {
                Text("利用規約とプライバシーポリシーに同意します").font(.footnote).foregroundStyle(FateTheme.muted)
            }.tint(FateTheme.gold)
            Spacer()
            Button("この内容で鑑定する") { onComplete(input) }.buttonStyle(GoldButtonStyle()).disabled(!acceptedTerms).opacity(acceptedTerms ? 1 : 0.45)
        }
    }

    static let prefectures = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]
}

private struct OnboardingScaffold<Content: View>: View {
    let page: Int; let onBack: () -> Void; @ViewBuilder let content: Content
    var body: some View { VStack(alignment: .leading, spacing: 22) { HStack { Button(action: onBack) { Image(systemName: "chevron.left").font(.title3).foregroundStyle(FateTheme.ink) }; Spacer(); FateMark(size: 34); Spacer(); Text("\(page) / 5").font(.caption).foregroundStyle(FateTheme.muted) }; content }.padding(.horizontal, 28).padding(.vertical, 22) }
}

private struct FateMark: View {
    let size: CGFloat
    var body: some View { ZStack { Circle().stroke(FateTheme.line.opacity(0.55), lineWidth: 1); Circle().trim(from: 0.07, to: 0.74).stroke(FateTheme.gold, style: StrokeStyle(lineWidth: max(4, size * 0.09), lineCap: .round)).rotationEffect(.degrees(-52)); Circle().fill(FateTheme.gold).frame(width: size * 0.12, height: size * 0.12).offset(x: size * 0.25, y: -size * 0.25) }.frame(width: size, height: size) }
}

private struct FeatureRow: View { let number: String; let title: String; let text: String; var body: some View { HStack(alignment: .top, spacing: 14) { Text(number).font(.caption).foregroundStyle(FateTheme.gold); VStack(alignment: .leading, spacing: 5) { Text(title).font(.system(size: 18, weight: .semibold, design: .serif)); Text(text).font(.subheadline).foregroundStyle(FateTheme.muted) } }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line)) } }
private struct ReviewRow: View { let label: String; let value: String; var divider = true; var body: some View { VStack(spacing: 0) { HStack { Text(label).foregroundStyle(FateTheme.muted); Spacer(); Text(value).fontWeight(.semibold) }.padding(16); if divider { Divider().padding(.leading, 16) } } } }

private struct LockScreenNotificationPreview: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [.black.opacity(0.83), FateTheme.gold.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(spacing: 8) {
                Text("9:41").font(.system(size: 44, weight: .light)).foregroundStyle(.white)
                Text("8月17日 月曜日").font(.caption).foregroundStyle(.white.opacity(0.82))
                HStack(alignment: .top, spacing: 10) {
                    FateMark(size: 30)
                    VStack(alignment: .leading, spacing: 4) { HStack { Text("Fate Lab").fontWeight(.semibold); Spacer(); Text("今").foregroundStyle(.secondary) }; Text("新しい流れが重なる時期です").fontWeight(.semibold); Text("鑑定書に、大切な時期の読み解きが届きました。") }
                    .font(.caption).foregroundStyle(.black)
                }.padding(12).background(.white.opacity(0.92)).clipShape(RoundedRectangle(cornerRadius: 18))
            }.padding(18)
        }.frame(maxWidth: .infinity).frame(height: 250).clipShape(RoundedRectangle(cornerRadius: 26))
    }
}
