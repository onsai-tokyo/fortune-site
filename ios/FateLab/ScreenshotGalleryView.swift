#if DEBUG
import SwiftUI

enum ScreenshotMode: String {
    case auth, report, reportMiddle, reportTiming, reportEnd, history, chat, paywall, premium, profile

    static var current: ScreenshotMode? {
        guard let index = ProcessInfo.processInfo.arguments.firstIndex(of: "--screenshot"),
              ProcessInfo.processInfo.arguments.indices.contains(index + 1) else { return nil }
        return ScreenshotMode(rawValue: ProcessInfo.processInfo.arguments[index + 1])
    }
}

struct ScreenshotGalleryView: View {
    let screen: ScreenshotMode

    var body: some View {
        NavigationStack {
            Group {
                switch screen {
                case .auth: auth
                case .report: LiveReportScreenshotView(position: .top)
                case .reportMiddle: LiveReportScreenshotView(position: .middle)
                case .reportTiming: LiveReportScreenshotView(position: .timing)
                case .reportEnd: LiveReportScreenshotView(position: .end)
                case .history: history
                case .chat: chat(paywall: false)
                case .paywall: paywallPreview
                case .premium: premium
                case .profile: profile
                }
            }
            .background(FateTheme.ivory)
        }
    }

    private var auth: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("FATE LAB · MEMBER").font(.caption).tracking(4).foregroundStyle(FateTheme.gold)
                Text("ログイン").font(.system(size: 31, weight: .medium, design: .serif))
                Text("鑑定書と質問の内容を安全に保存します。先ほどの鑑定内容もそのまま引き継げます。")
                    .foregroundStyle(FateTheme.muted).lineSpacing(6)
                TextField("メールアドレス", text: .constant("")).textFieldStyle(.roundedBorder)
                SecureField("パスワード（8文字以上）", text: .constant("")).textFieldStyle(.roundedBorder)
                Button("ログイン") {}.buttonStyle(GoldButtonStyle())
                Divider().overlay(FateTheme.line)
                Text("はじめての方").font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
                Button("新規登録（無料）") {}.buttonStyle(OutlineGoldButtonStyle())
            }.padding(28)
        }.fateScreenTitle("FATE LAB")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {} label: { Image(systemName: "xmark") }
                        .frame(width: 44, height: 44).accessibilityLabel("閉じる")
                }
            }
    }

    private var report: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("鑑定が完了しました").font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
                Text("命式鑑定書").font(.system(size: 32, weight: .medium, design: .serif))
                ReportCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("先に読む要約").font(.system(size: 21, weight: .medium, design: .serif))
                        Text("周囲をよく見ながら、自分で決めたことは最後まで形にする人です。人との関係では、曖昧なまま進めるより、言葉で確かめ合えると安心できます。")
                            .lineSpacing(7)
                    }
                }
                Text("命式・計算データ").font(.system(size: 23, weight: .medium, design: .serif))
                ReportCard { Text("四柱推命　日柱：壬午\n算命学　中心星：鳳閣星\n西洋占星術　太陽：魚座").lineSpacing(8) }
                Text("共通して現れた本質").font(.system(size: 23, weight: .medium, design: .serif))
                Text("考えを整理し、相手に伝わる形へ整えることが得意です。責任を引き受ける場面では、途中で投げずに完成まで進めます。")
                    .lineSpacing(8)
                ReportCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("さらに深掘り鑑定へ").font(.system(size: 21, weight: .medium, design: .serif))
                        Text("9つの占術結果をもとに、恋愛・仕事・時期などを詳しく質問できます。")
                            .font(.footnote).foregroundStyle(FateTheme.muted)
                        Button("この結果について質問する（無料）") {}.buttonStyle(GoldButtonStyle())
                    }
                }
            }.padding(20)
        }
    }

    private var history: some View {
        List {
            Section {
                historyRow("1995年2月20日の命式鑑定書", "恋愛と結婚の流れについて", "質問 3件 ・ 8/16")
                historyRow("1997年7月30日の命式鑑定書", "仕事の転機について", "質問 2件 ・ 8/15")
                historyRow("1995年3月16日の命式鑑定書", "今後3年の流れについて", "質問 1件 ・ 8/14")
            } header: { Text("3件") }
            Section { Button("新しく鑑定する") {}.buttonStyle(OutlineGoldButtonStyle()).listRowBackground(FateTheme.ivory) }
        }.scrollContentBackground(.hidden).fateScreenTitle("鑑定書一覧")
    }

    private func historyRow(_ title: String, _ subtitle: String, _ meta: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 7) {
                Text(title).font(.system(size: 18, weight: .medium, design: .serif))
                Text(subtitle).font(.caption).foregroundStyle(FateTheme.muted)
                Text(meta).font(.caption2).foregroundStyle(FateTheme.weak)
            }
            Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.weak)
        }.padding(.vertical, 10).listRowBackground(FateTheme.paper)
    }

    private func chat(paywall: Bool) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("無料でお読みいただける残り：1回")
                        .font(.system(size: 14)).foregroundStyle(FateTheme.muted)
                    Text("継続鑑定では、回数の制限なくお読みいただけます")
                        .font(.system(size: 13)).foregroundStyle(FateTheme.gold)
                    ReportCard { HStack { Text("もとの鑑定書を確認").font(.system(size: 17, weight: .medium, design: .serif)); Spacer(); Image(systemName: "chevron.right") } }
                    bubble("2027年の恋愛と結婚の流れを詳しく知りたいです。", user: true)
                    bubble("2027年は、関係を曖昧なままにせず、今後について具体的に話しやすい時期です。\n\n・交際を正式な形にする\n・同居や結婚後の生活を話し合う\n・仕事との両立条件を決める\n\nこうした現実的な話が進みやすくなります。", user: false)
                    if !paywall {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("続けて読み解く").font(.system(size: 16, weight: .medium, design: .serif)).padding(.bottom, 6)
                            ForEach(["この流れに向けて準備しておくことは？", "仕事と恋愛が重なる時期の考え方は？", "次の大きな転換期はいつごろ？"], id: \.self) { item in
                                Text(item).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 14)
                                Divider().overlay(FateTheme.line)
                            }
                        }
                    } else {
                        Divider().overlay(FateTheme.line)
                        ReportCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("FATE LAB 継続鑑定").font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
                                Text("もう少し、深く読み解きますか。").font(.system(size: 22, weight: .medium, design: .serif))
                                Text("保存した鑑定書をもとに、気になったことを回数制限なく質問できます。")
                                    .font(.footnote).foregroundStyle(FateTheme.muted)
                                Text("月額 2,980円\n1ヶ月ごとの自動更新").font(.system(size: 17, weight: .semibold))
                                Button("継続鑑定を始める") {}.buttonStyle(GoldButtonStyle())
                                Button("購入内容を復元") {}.frame(maxWidth: .infinity).foregroundStyle(FateTheme.gold)
                                Text("期間終了の24時間前までに解約されない場合は更新されます。解約はApp Storeの設定からいつでも行えます。")
                                    .font(.caption2).foregroundStyle(FateTheme.muted)
                                Text("利用規約 ・ プライバシーポリシー").font(.caption).foregroundStyle(FateTheme.gold).frame(maxWidth: .infinity)
                            }
                        }
                    }
                }.padding(18)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("鑑定結果について質問する…", text: .constant(""), axis: .vertical)
                    .padding(12).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
                Text("読み解く").font(.system(size: 14, weight: .semibold, design: .serif)).foregroundStyle(.white)
                    .padding(.horizontal, 15).frame(height: 38).background(FateTheme.gold).clipShape(RoundedRectangle(cornerRadius: 8))
            }.padding(14).background(FateTheme.ivory)
        }.fateScreenTitle("鑑定結果への質問")
    }

    private var paywallPreview: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("無料でお読みいただける2回分を、ご利用いただきました。")
                    .font(.system(size: 15)).foregroundStyle(FateTheme.muted)
                Text("FATE LAB 継続鑑定").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                Text("この鑑定書を、\nいつでも開けるように。")
                    .font(.system(size: 30, weight: .medium, design: .serif)).lineSpacing(5)
                VStack(alignment: .leading, spacing: 14) {
                    Label("鑑定結果について、回数の制限なく質問できます", systemImage: "checkmark")
                    Label("これまでの質問と回答は、いつでも読み返せます", systemImage: "checkmark")
                }.lineSpacing(5)
                Divider().overlay(FateTheme.line)
                Text("月額 2,980円").font(.system(size: 24, weight: .semibold, design: .serif))
                Text("1ヶ月ごとの自動更新").foregroundStyle(FateTheme.muted)
                Button("継続鑑定を始める") {}.buttonStyle(GoldButtonStyle())
                Button("購入を復元") {}.frame(maxWidth: .infinity).foregroundStyle(FateTheme.gold)
                Text("期間終了の24時間前までに解約されない場合、自動的に更新されます。解約はApp Storeの設定からいつでも行えます。")
                    .font(.caption).foregroundStyle(FateTheme.muted).lineSpacing(5)
                Text("利用規約 ・ プライバシーポリシー").font(.caption).foregroundStyle(FateTheme.gold).frame(maxWidth: .infinity)
            }.padding(24)
        }.background(FateTheme.ivory).fateScreenTitle("継続鑑定")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {} label: { Image(systemName: "xmark") }
                        .frame(width: 44, height: 44).accessibilityLabel("閉じる")
                }
            }
    }

    private func bubble(_ text: String, user: Bool) -> some View {
        HStack {
            if user { Spacer(minLength: 48) }
            Text(text).lineSpacing(7).padding(16)
                .background(user ? FateTheme.gold.opacity(0.14) : FateTheme.paper)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            if !user { Spacer(minLength: 24) }
        }
    }

    private var premium: some View {
        List {
            Section("継続鑑定") {
                Label("継続鑑定をご利用中です", systemImage: "checkmark.seal.fill").foregroundStyle(FateTheme.gold)
                Text("鑑定結果について、回数制限なく質問できます。")
                Button("サブスクリプションを管理") {}
                Button("購入を復元") {}
            }
            Section("アカウント") { Text("sample@fate-lab.com"); Button("ログアウト") {}.foregroundStyle(FateTheme.ink); Button("アカウントを削除") {}.foregroundStyle(FateTheme.destructive) }
            Section("サービスについて") { Text("利用規約"); Text("プライバシーポリシー"); Text("特定商取引法に基づく表記") }
        }.scrollContentBackground(.hidden).fateScreenTitle("設定")
    }

    private var profile: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("FATE LAB · YOUR PROFILE").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                Text("あなたについて\nわかってきたこと").font(.system(size: 31, weight: .medium, design: .serif))
                Text("質問を重ねながら『合っている』と選んだ内容だけを保存します。")
                    .foregroundStyle(FateTheme.muted).lineSpacing(6)
                ReportCard { Text("責任の範囲と期限が明確なとき、安心して力を発揮できます。").lineSpacing(6) }
                ReportCard { Text("恋愛では、察し合うよりも言葉で確認できる関係を大切にします。").lineSpacing(6) }
                ReportCard { Text("大きな選択では、勢いだけで決めず、現実条件を一つずつ確認します。").lineSpacing(6) }
            }.padding(20)
        }.fateScreenTitle("あなたについて")
    }
}

private enum ReportScreenshotPosition { case top, middle, timing, end }

private struct LiveReportScreenshotView: View {
    let position: ReportScreenshotPosition
    @State private var report: GeneratedReport?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let report {
                rendered(report)
            } else if let errorMessage {
                ReportCard { Text(errorMessage).foregroundStyle(.red) }.padding(20)
            } else {
                ProgressView("実際の無料鑑定書を生成しています…").tint(FateTheme.gold)
            }
        }.task { await load() }.fateScreenTitle("命式鑑定書")
    }

    @ViewBuilder private func rendered(_ report: GeneratedReport) -> some View {
        switch position {
        case .top:
            ScrollView { ReportDocumentView(report: report, questionTitle: "この結果について質問する（無料）", isSaving: false) {}.padding(20) }
        case .middle:
            if let card = report.cards.first(where: { !$0.isTiming }) { InsightDetailView(item: card) {} }
        case .timing:
            if let card = report.cards.first(where: \.isTiming) { InsightDetailView(item: card) {} }
        case .end:
            if let card = report.cards.last { InsightDetailView(item: card) {} }
        }
    }

    private func load() async {
        let cacheKey = "fatelab.screenshot.fullReport.v1"
        let importedURL = URL.documentsDirectory.appending(path: "screenshot-report.txt")
        if let imported = try? String(contentsOf: importedURL, encoding: .utf8), !imported.isEmpty {
            UserDefaults.standard.set(imported, forKey: cacheKey)
        }
        var input = BirthInput()
        input.date = Calendar(identifier: .gregorian).date(from: DateComponents(year: 1995, month: 2, day: 20)) ?? input.date
        input.hasTime = true
        input.time = Calendar(identifier: .gregorian).date(from: DateComponents(hour: 5, minute: 40)) ?? input.time
        input.birthplace = "愛知県"
        input.gender = "female"
        do {
            let value = try await APIClient.shared.generateReport(input: input)
            report = value
            UserDefaults.standard.set(value.text, forKey: cacheKey)
        } catch { errorMessage = error.localizedDescription }
    }
}
#endif
