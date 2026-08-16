import SwiftUI

struct ReportDocumentView: View {
    let report: GeneratedReport
    let questionTitle: String
    let isSaving: Bool
    let askQuestion: () -> Void
    var showsCompletionMessage = true
    private let document: ReportDocument

    init(report: GeneratedReport, questionTitle: String, isSaving: Bool, askQuestion: @escaping () -> Void) {
        self.report = report; self.questionTitle = questionTitle; self.isSaving = isSaving; self.askQuestion = askQuestion
        document = ReportParser.parse(report.text)
    }

    private var summary: ReportChapter? { document.chapters.first { $0.title == "先に読む要約" } }
    private var readingChapters: [ReportChapter] { document.chapters.filter { $0.title != "先に読む要約" } }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            if showsCompletionMessage {
                Text("鑑定が完了しました").font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
            }
            Text("命式鑑定書").font(.system(size: 32, weight: .medium, design: .serif))
            birthSummary
            if let summary {
                ReportCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("先に読む要約").font(.system(size: 23, weight: .medium, design: .serif))
                        ForEach(Array(summary.nodes.enumerated()), id: \.offset) { _, node in ReportNodeView(node: node) }
                    }
                }
            }
            Button(isSaving ? "鑑定書を保存しています…" : questionTitle, action: askQuestion)
                .buttonStyle(GoldButtonStyle()).disabled(isSaving)
            Divider().overlay(FateTheme.line)
            Text("目次").font(.system(size: 24, weight: .medium, design: .serif))
            chapterLink(number: 1, title: "命式・計算データ", detail: "9つの占術の計算結果") {
                CalculatedDataChapterView(data: report.calculatedData, index: 1, total: readingChapters.count + 1,
                                          questionTitle: "さらに詳しく質問する", askQuestion: askQuestion)
            }
            ForEach(Array(readingChapters.enumerated()), id: \.element.id) { index, chapter in
                chapterLink(number: index + 2, title: chapter.title, detail: chapter.detail) {
                    ReportChapterView(chapter: chapter, index: index + 2, total: readingChapters.count + 1,
                                      questionTitle: "さらに詳しく質問する", askQuestion: askQuestion)
                }
            }
            Text("本文 \(document.sourceCharacterCount.formatted())文字・すべての章を省略せず掲載しています。")
                .font(.caption).foregroundStyle(FateTheme.muted)
        }
    }

    private var birthSummary: some View {
        VStack(alignment: .leading, spacing: 5) {
            if let date = report.birthData["birthDate"] as? String { Text(date.replacingOccurrences(of: "-", with: "/") + " 生") }
            HStack {
                if let place = report.birthData["birthplace"] as? String { Text(place) }
                if let gender = report.birthData["gender"] as? String { Text("／ " + (gender == "female" ? "女性" : "男性")) }
            }
        }.font(.system(size: 14)).foregroundStyle(FateTheme.muted)
    }

    @ViewBuilder private func chapterLink<Destination: View>(number: Int, title: String, detail: String?, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) {
            HStack(spacing: 14) {
                Text("第\(japaneseNumber(number))章")
                    .font(.system(size: 13, weight: .medium, design: .serif))
                    .foregroundStyle(FateTheme.gold)
                    .frame(width: 52, alignment: .leading)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 17, weight: .medium, design: .serif)).foregroundStyle(FateTheme.ink)
                    if let detail { Text(detail).font(.caption).foregroundStyle(FateTheme.muted) }
                }
                Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.weak)
            }.padding(.vertical, 14)
        }
        Divider().overlay(FateTheme.line)
    }
}

struct ReportChapterView: View {
    let chapter: ReportChapter
    let index: Int
    let total: Int
    var questionTitle: String? = nil
    var askQuestion: (() -> Void)? = nil
    @State private var restoredPosition = false

    private var positionKey: String { "fatelab.report.position.\(chapter.id)" }

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    VStack(spacing: 12) {
                        Text("第 \(japaneseNumber(index)) 章").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                        Text(chapter.title).font(.system(size: 27, weight: .medium, design: .serif)).multilineTextAlignment(.center)
                        Rectangle().fill(FateTheme.gold).frame(width: 48, height: 1)
                    }.frame(maxWidth: .infinity).padding(.vertical, 26).id(-1)
                    ForEach(Array(displayNodes.enumerated()), id: \.offset) { nodeIndex, node in
                        ReportNodeView(node: node)
                            .id(nodeIndex)
                            .onAppear {
                                guard restoredPosition else { return }
                                UserDefaults.standard.set(nodeIndex, forKey: positionKey)
                            }
                    }
                    if !chapterEvidence.groups.isEmpty {
                        EvidenceDisclosureView(evidence: chapterEvidence, title: "この章で参照した内容")
                            .padding(.top, 16)
                    }
                    if let questionTitle, let askQuestion {
                        Button(questionTitle, action: askQuestion)
                            .buttonStyle(GoldButtonStyle())
                            .padding(.top, 8)
                    }
                }
                .padding(20)
            }
            .onAppear {
                guard !restoredPosition else { return }
                restoredPosition = true
                guard UserDefaults.standard.object(forKey: positionKey) != nil else { return }
                let storedIndex = UserDefaults.standard.integer(forKey: positionKey)
                DispatchQueue.main.async { reader.scrollTo(storedIndex, anchor: .top) }
            }
        }
        .safeAreaInset(edge: .top) {
            GeometryReader { geometry in
                Rectangle().fill(FateTheme.gold).frame(width: geometry.size.width * progress, height: 2)
            }.frame(height: 2).background(FateTheme.line.opacity(0.35))
        }
        .background(FateTheme.ivory)
        .navigationTitle(chapter.title).navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Text("\(index) / \(total)").font(.caption).foregroundStyle(FateTheme.muted) } }
    }

    // This bar represents the current chapter in the whole report. The chapter
    // counter on the right uses the same numerator and denominator.
    private var progress: CGFloat { total > 0 ? min(1, CGFloat(index) / CGFloat(total)) : 1 }

    private var displayNodes: [ReportNode] { chapter.nodes.compactMap(removingEvidence) }

    private var chapterEvidence: EvidenceGroups {
        var groups: [EvidenceGroups.Group] = []
        for node in chapter.nodes { collectEvidence(from: node, into: &groups) }
        return EvidenceGroups(groups: groups)
    }

    private func removingEvidence(from node: ReportNode) -> ReportNode? {
        switch node {
        case .evidence: return nil
        case .year(var year):
            year.body = year.body.compactMap(removingEvidence)
            return .year(year)
        default: return node
        }
    }

    private func collectEvidence(from node: ReportNode, into groups: inout [EvidenceGroups.Group]) {
        switch node {
        case .evidence(let evidence):
            for incoming in evidence.groups {
                if let index = groups.firstIndex(where: { $0.id == incoming.id }) {
                    for item in incoming.items where !groups[index].items.contains(where: { $0.system == item.system && $0.detail == item.detail }) {
                        groups[index].items.append(item)
                    }
                } else { groups.append(incoming) }
            }
        case .year(let year):
            for child in year.body { collectEvidence(from: child, into: &groups) }
        default: break
        }
    }
}

struct ReportNodeView: View {
    let node: ReportNode
    var body: some View {
        switch node {
        case .subsection(let title):
            HStack(spacing: 10) { Rectangle().fill(FateTheme.gold).frame(width: 4); Text(title).font(.system(size: 19, weight: .medium, design: .serif)) }
                .padding(.top, 18).padding(.bottom, 4)
        case .paragraph(let inlines): InlineReportText(inlines: inlines)
        case .bullet(let inlines): LabeledBulletView(inlines: inlines)
        case .advice(let inlines):
            HStack(alignment: .top, spacing: 10) { Text("▸").foregroundStyle(FateTheme.gold); InlineReportText(inlines: inlines) }
                .padding(12).background(FateTheme.gold.opacity(0.06)).clipShape(RoundedRectangle(cornerRadius: 10))
        case .evidence(let groups): EvidenceDisclosureView(evidence: groups)
        case .year(let year): YearCardView(year: year)
        }
    }
}

private struct LabeledBulletView: View {
    let inlines: [ReportInline]

    private var parts: (title: String, body: String)? {
        let text = inlines.map(\.plainText).joined()
        guard let separator = text.firstIndex(of: "：") else { return nil }
        let title = String(text[..<separator]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, title.count <= 28 else { return nil }
        let bodyStart = text.index(after: separator)
        return (title, String(text[bodyStart...]).trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var body: some View {
        if let parts {
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 10) {
                    Rectangle().fill(FateTheme.gold).frame(width: 3, height: 22)
                    Text(parts.title).font(.system(size: 18, weight: .semibold, design: .serif))
                }
                if !parts.body.isEmpty {
                    Text(parts.body).font(.system(size: 16)).lineSpacing(9).foregroundStyle(FateTheme.ink)
                        .padding(.leading, 13)
                }
            }
            .padding(.top, 8)
        } else {
            HStack(alignment: .top, spacing: 10) { Text("・"); InlineReportText(inlines: inlines) }
        }
    }
}

private struct InlineReportText: View {
    let inlines: [ReportInline]
    var body: some View { Text(attributed).font(.system(size: 16)).lineSpacing(9).foregroundStyle(FateTheme.ink) }
    private var attributed: AttributedString {
        var result = AttributedString()
        for inline in inlines {
            var value = AttributedString(inline.plainText)
            if case .highlight = inline { value.font = .system(size: 16, weight: .bold); value.backgroundColor = FateTheme.gold.opacity(0.14) }
            result.append(value)
        }
        return result
    }
}

private struct YearCardView: View {
    let year: ReportYearCard
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            if year.isTurning { Text("転換期").font(.caption2).tracking(2).foregroundStyle(FateTheme.gold) }
            Text(year.year).font(.system(size: 20, weight: .medium, design: .serif))
            if !year.summary.isEmpty { Text(year.summary).font(.system(size: 15)).foregroundStyle(FateTheme.muted) }
            if !year.domains.isEmpty {
                HStack { ForEach(year.domains, id: \.self) { Text($0).font(.caption2).padding(.horizontal, 10).padding(.vertical, 6).overlay(RoundedRectangle(cornerRadius: 6).stroke(FateTheme.line)) } }
            }
            Divider().overlay(FateTheme.line.opacity(0.7))
            ForEach(Array(year.body.enumerated()), id: \.offset) { _, node in ReportNodeView(node: node) }
        }.padding(18).background(FateTheme.paper)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(year.isTurning ? FateTheme.gold : FateTheme.line, lineWidth: year.isTurning ? 1.5 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct EvidenceDisclosureView: View {
    let evidence: EvidenceGroups
    var title = "この読み解きの根拠"
    @State private var expanded = false
    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(evidence.groups) { group in
                    VStack(alignment: .leading, spacing: 7) {
                        Text(group.family).font(.system(size: 15, weight: .semibold, design: .serif))
                        ForEach(Array(group.items.enumerated()), id: \.offset) { _, item in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.system).font(.system(size: 14)).foregroundStyle(FateTheme.muted)
                                Text(item.detail).font(.system(size: 15, design: .serif))
                            }
                        }
                    }
                }
            }.padding(.top, 12)
        } label: { Text(title).font(.system(size: 15, weight: .medium, design: .serif)) }
            .padding(14).background(FateTheme.gold.opacity(0.045)).clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct CalculatedDataChapterView: View {
    let data: [String: Any]
    let index: Int
    let total: Int
    var questionTitle: String? = nil
    var askQuestion: (() -> Void)? = nil
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(spacing: 12) {
                    Text("第 一 章").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                    Text("命式・計算データ").font(.system(size: 27, weight: .medium, design: .serif))
                    Text("9つの占術から算出した生データを省略せず表示します。").font(.caption).foregroundStyle(FateTheme.muted)
                }.frame(maxWidth: .infinity).padding(.vertical, 26)
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                        ReportCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(displayLabel(section.key))
                                    .font(.system(size: 19, weight: .medium, design: .serif))
                                Divider().overlay(FateTheme.line)
                                ForEach(Array(flatten(section.value).enumerated()), id: \.offset) { _, row in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(row.label).font(.system(size: 13, design: .serif)).foregroundStyle(FateTheme.gold)
                                        Text(row.value).font(.system(size: 15, design: .serif)).lineSpacing(5).textSelection(.enabled)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                    }
                }
                if let questionTitle, let askQuestion {
                    Button(questionTitle, action: askQuestion).buttonStyle(GoldButtonStyle())
                }
            }.padding(20)
        }.background(FateTheme.ivory).navigationTitle("命式・計算データ").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Text("1 / \(total)").font(.caption).foregroundStyle(FateTheme.muted) } }
    }
    private var sections: [(key: String, value: Any)] {
        data.keys.sorted().compactMap { key in data[key].map { (key, $0) } }
    }

    private func flatten(_ value: Any, path: [String] = []) -> [(label: String, value: String)] {
        if let dictionary = value as? [String: Any] {
            let hiddenKeys: Set<String> = ["key", "label", "signals", "longitude"]
            return dictionary.keys.sorted().filter { !hiddenKeys.contains($0) }.flatMap { key -> [(label: String, value: String)] in
                guard let nestedValue = dictionary[key] else { return [] }
                if key == "annual" || key == "decadal" {
                    return [(label: (path + [displayLabel(key)]).joined(separator: "・"), value: "年ごとの詳しい内容は「時期」章に掲載しています。")]
                }
                return flatten(nestedValue, path: path + [displayLabel(key)])
            }
        }
        if let array = value as? [Any] {
            return array.enumerated().flatMap { index, item in
                flatten(item, path: path + ["\(index + 1)"])
            }
        }
        return [(path.isEmpty ? "値" : path.joined(separator: "・"), displayValue(value))]
    }

    private func displayValue(_ value: Any) -> String {
        if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() { return number.boolValue ? "あり" : "なし" }
            let decimal = number.doubleValue
            if decimal.rounded() == decimal { return String(Int(decimal)) }
            return String(format: "%.2f", decimal)
        }
        if value is NSNull { return "算出なし" }
        return String(describing: value)
    }

    private func displayLabel(_ key: String) -> String {
        let labels = [
            "astrology": "西洋・インド占星術", "available": "算出状況", "method": "計算方法", "reason": "注記",
            "birthplace": "出生地", "chusatsu": "天中殺", "elementBalance": "五行バランス", "scores": "五行スコア",
            "fourPillars": "四柱推命", "branch": "地支", "hiddenStems": "蔵干", "element": "五行", "stem": "天干",
            "tenGod": "通変星", "sanmei": "算命学", "ziwei": "紫微斗数", "numerology": "数秘術", "kyusei": "九星気学",
            "sukuyo": "宿曜", "nayin": "納音", "timing": "時期運", "western": "西洋占星術", "vedic": "インド占星術",
            "sanmeiChart": "算命学・人体星図", "sanmeiRelations": "算命学・位相法", "sanmeiStar": "中心星",
            "bodyChart": "人体星図", "subordinateStars": "従星", "center": "中央（胸）", "north": "北（頭）",
            "south": "南（腹）", "east": "東（左手）", "west": "西（右手）", "early": "初年期", "middle": "中年期",
            "late": "晩年期", "star": "星", "stage": "十二運", "stemTenGod": "天干の通変星", "twelveStage": "十二運",
            "kanshi": "干支", "honmeiName": "本命星", "kyuseiProfile": "九星気学", "yearStar": "年の星",
            "monthStar": "月の星", "dayStar": "日の星", "timeStar": "時刻の星", "lifePathNumber": "運命数",
            "numerologyProfile": "数秘術", "birthDayNumber": "誕生数", "attitudeNumber": "態度数",
            "personalYear": "対象年", "personalYearNumber": "個人年数", "strength": "命式の強弱", "favorableElements": "活かす五行",
            "supportRatio": "支援の比率", "ascendant": "アセンダント", "midheaven": "MC", "planets": "天体",
            "aspects": "主要アスペクト", "sign": "星座", "degree": "度数", "retrograde": "逆行", "name": "天体名",
            "ayanamsha": "アヤナンシャ", "moonNakshatra": "月のナクシャトラ", "moonPada": "パーダ", "annual": "年運",
            "decadal": "長期運", "dashaLord": "ダシャー", "palaces": "十二宮", "majorStars": "主星",
            "minorStars": "副星", "brightness": "星の明るさ", "earthlyBranch": "地支", "heavenlyStem": "天干",
            "isBodyPalace": "身宮", "mutagen": "四化", "mutagenStars": "四化星", "activePalaces": "動く宮",
            "fiveElementsClass": "五行局", "lunarDate": "旧暦日", "solarDate": "新暦日", "soul": "命宮",
            "body": "身宮", "earthlyBranchOfSoulPalace": "命宮の地支", "earthlyBranchOfBodyPalace": "身宮の地支",
            "time": "出生時刻", "timeRange": "時刻区分", "standardTimeNote": "時刻の注記", "relations": "関係",
            "relation": "関係", "branches": "地支", "detail": "詳細", "meaning": "意味", "note": "注記", "year": "年", "range": "期間",
            "shichuYear": "年柱", "shichuMonth": "月柱", "shichuDay": "日柱", "shichuHour": "時柱"
        ]
        return labels[key] ?? key
    }
}

private func japaneseNumber(_ value: Int) -> String {
    let values = ["〇","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"]
    return values.indices.contains(value) ? values[value] : String(value)
}
