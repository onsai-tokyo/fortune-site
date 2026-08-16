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
            Text("鑑定書 全文").font(.system(size: 24, weight: .medium, design: .serif))
            CalculatedDataChapterView(data: report.calculatedData, index: 1, total: readingChapters.count + 1,
                                      questionTitle: "さらに詳しく質問する", askQuestion: askQuestion)
            ForEach(Array(readingChapters.enumerated()), id: \.element.id) { index, chapter in
                InlineReportChapterView(chapter: chapter, index: index + 2,
                                        questionTitle: "さらに詳しく質問する", askQuestion: askQuestion)
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

}

private struct InlineReportChapterView: View {
    let chapter: ReportChapter
    let index: Int
    let questionTitle: String
    let askQuestion: () -> Void

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 18) {
            VStack(spacing: 12) {
                Text("第 \(japaneseNumber(index)) 章").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                Text(chapter.title).font(.system(size: 27, weight: .medium, design: .serif)).multilineTextAlignment(.center)
                Rectangle().fill(FateTheme.gold).frame(width: 48, height: 1)
            }.frame(maxWidth: .infinity).padding(.top, 32).padding(.bottom, 12)
            ForEach(Array(displayNodes.enumerated()), id: \.offset) { _, node in ReportNodeView(node: node) }
            if !chapterEvidence.groups.isEmpty {
                EvidenceDisclosureView(evidence: chapterEvidence, title: "この章で参照した内容")
                    .padding(.top, 16)
            }
            Button(questionTitle, action: askQuestion).buttonStyle(GoldButtonStyle()).padding(.top, 8)
            Divider().overlay(FateTheme.line).padding(.top, 18)
        }
    }

    private var displayNodes: [ReportNode] { chapter.nodes.compactMap(removingEvidence) }
    private var chapterEvidence: EvidenceGroups {
        var groups: [EvidenceGroups.Group] = []
        for node in chapter.nodes { collectEvidence(from: node, into: &groups) }
        return EvidenceGroups(groups: groups)
    }
    private func removingEvidence(from node: ReportNode) -> ReportNode? {
        switch node {
        case .evidence: return nil
        case .year(var year): year.body = year.body.compactMap(removingEvidence); return .year(year)
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
        case .year(let year): for child in year.body { collectEvidence(from: child, into: &groups) }
        default: break
        }
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
        if let parts, !parts.body.isEmpty {
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 10) {
                    Rectangle().fill(FateTheme.gold).frame(width: 3, height: 22)
                    Text(parts.title).font(.system(size: 18, weight: .semibold, design: .serif))
                }
                Text(parts.body).font(.system(size: 16)).lineSpacing(9).foregroundStyle(FateTheme.ink)
                    .padding(.leading, 13)
            }
            .padding(.top, 8)
        } else if parts != nil {
            EmptyView()
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
    private var compactDomains: [String] {
        var result: [String] = []
        for value in year.domains {
            let tag: String
            if value.contains("別れ") || value.contains("関係の見直し") { tag = "関係の見直し" }
            else if value.contains("転職") || value.contains("働き方") { tag = "転職" }
            else if value.contains("挑戦") { tag = "挑戦" }
            else if value.contains("引越") || value.contains("生活環境") { tag = "引越し" }
            else if value.contains("結婚") { tag = "結婚" }
            else if value.contains("恋愛") { tag = "恋愛" }
            else if value.contains("仕事") || value.contains("収入") { tag = "仕事" }
            else { continue }
            if !result.contains(tag) { result.append(tag) }
        }
        return result
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            if year.isTurning { Text("転換期").font(.caption2).tracking(2).foregroundStyle(FateTheme.gold) }
            Text(year.year).font(.system(size: 20, weight: .medium, design: .serif))
            if !year.summary.isEmpty { Text(year.summary).font(.system(size: 15)).foregroundStyle(FateTheme.muted) }
            if !compactDomains.isEmpty {
                TagFlowLayout(spacing: 7) {
                    ForEach(compactDomains, id: \.self) { domain in
                        Text("#\(domain)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(FateTheme.gold)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(FateTheme.gold.opacity(0.08))
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(FateTheme.gold.opacity(0.34)))
                    }
                }
            }
            Divider().overlay(FateTheme.line.opacity(0.7))
            ForEach(Array(year.body.enumerated()), id: \.offset) { _, node in ReportNodeView(node: node) }
        }.padding(18).background(FateTheme.paper)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(year.isTurning ? FateTheme.gold : FateTheme.line, lineWidth: year.isTurning ? 1.5 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct TagFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .greatestFiniteMagnitude
        var width: CGFloat = 0
        var height: CGFloat = 0
        var lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if width > 0 && width + spacing + size.width > maxWidth {
                height += lineHeight + spacing
                width = 0
                lineHeight = 0
            }
            width += (width == 0 ? 0 : spacing) + size.width
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth.isFinite ? maxWidth : width, height: height + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
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
        VStack(alignment: .leading, spacing: 20) {
                VStack(spacing: 12) {
                    Text("第 一 章").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                    Text("命式・計算データ").font(.system(size: 27, weight: .medium, design: .serif))
                    Text("9つの占術から算出した主要データを、見やすく整理しています。").font(.caption).foregroundStyle(FateTheme.muted)
                }.frame(maxWidth: .infinity).padding(.vertical, 26)
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                        ReportCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(displayLabel(section.key))
                                    .font(.system(size: 19, weight: .medium, design: .serif))
                                Divider().overlay(FateTheme.line)
                                compactTable(for: section.key, value: section.value)
                            }
                        }
                    }
                    if !auxiliaryRows.isEmpty {
                        ReportCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("東洋占術の補助データ")
                                    .font(.system(size: 19, weight: .medium, design: .serif))
                                Divider().overlay(FateTheme.line)
                                compactGrid(rows: auxiliaryRows)
                            }
                        }
                    }
                }
                if let questionTitle, let askQuestion {
                    Button(questionTitle, action: askQuestion).buttonStyle(GoldButtonStyle())
                }
                Divider().overlay(FateTheme.line).padding(.top, 18)
            }
            .padding(.top, 12)
    }
    private var sections: [(key: String, value: Any)] {
        let preferred = ["fourPillars", "elementBalance", "sanmeiChart", "sanmeiRelations", "ziwei", "astrology", "kyuseiProfile", "numerologyProfile"]
        return preferred.compactMap { key in
            guard let value = data[key] else { return nil }
            if key != "fourPillars" && conciseRows(for: key, value: value).isEmpty { return nil }
            return (key, value)
        }
    }

    private var auxiliaryRows: [(label: String, value: String)] {
        [("宿曜", "sukuyo"), ("納音", "nayin"), ("天中殺", "chusatsu")].compactMap { label, key in
            guard let value = data[key], let result = conciseRows(for: key, value: value).first?.value, !result.isEmpty else { return nil }
            return (label, result)
        }
    }

    @ViewBuilder
    private func compactTable(for key: String, value: Any) -> some View {
        if key == "fourPillars", let pillars = value as? [[String: Any]] {
            VStack(spacing: 0) {
                tableHeader(["柱", "干支", "通変星", "蔵干"])
                ForEach(Array(pillars.enumerated()), id: \.offset) { index, pillar in
                    let hidden = (pillar["hiddenStems"] as? [[String: Any]] ?? []).map {
                        "\($0["stem"] ?? "")（\($0["tenGod"] ?? "")）"
                    }.joined(separator: "・")
                    tableRow([
                        String(describing: pillar["label"] ?? "—"),
                        String(describing: pillar["kanshi"] ?? "—"),
                        String(describing: pillar["stemTenGod"] ?? "—"),
                        hidden.isEmpty ? "—" : hidden
                    ], shaded: index.isMultiple(of: 2))
                }
            }.clipShape(RoundedRectangle(cornerRadius: 8)).overlay(RoundedRectangle(cornerRadius: 8).stroke(FateTheme.line))
        } else if key == "elementBalance" {
            elementBalanceView(rows: conciseRows(for: key, value: value))
        } else if key == "sanmeiChart" {
            sanmeiBodyChart(value: value)
        } else if key == "numerologyProfile" {
            compactGrid(rows: conciseRows(for: key, value: value))
        } else {
            let rows = conciseRows(for: key, value: value)
            if rows.count == 1, let row = rows.first, row.label == "値" {
                Text(row.value)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(FateTheme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 2)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                        HStack(alignment: .firstTextBaseline, spacing: 14) {
                            Text(row.label)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(FateTheme.muted)
                                .frame(width: 104, alignment: .leading)
                            Text(row.value)
                                .font(.system(size: 15))
                                .foregroundStyle(FateTheme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 10)
                        if index < rows.count - 1 { Divider().overlay(FateTheme.line.opacity(0.65)) }
                    }
                }
            }
        }
    }

    private func sanmeiBodyChart(value: Any) -> some View {
        let dictionary = value as? [String: Any] ?? [:]
        let chart = dictionary["bodyChart"] as? [String: Any] ?? [:]
        let subordinate = dictionary["subordinateStars"] as? [String: Any] ?? [:]
        func star(_ key: String, from source: [String: Any]) -> String {
            let item = source[key] as? [String: Any] ?? [:]
            let name = String(describing: item["star"] ?? "—")
            let stage = String(describing: item["stage"] ?? "")
            return stage.isEmpty ? name : "\(name)（\(stage)）"
        }
        let cells: [(String, String, String)] = [
            ("人体星図", "全体", "figure.stand"),
            ("頭", star("north", from: chart), ""),
            ("左肩", star("early", from: subordinate), ""),
            ("右手", star("west", from: chart), ""),
            ("胸・中心", star("center", from: chart), ""),
            ("左手", star("east", from: chart), ""),
            ("右足", star("late", from: subordinate), ""),
            ("腹", star("south", from: chart), ""),
            ("左足", star("middle", from: subordinate), "")
        ]
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 3), spacing: 1) {
            ForEach(Array(cells.enumerated()), id: \.offset) { index, cell in
                VStack(spacing: 7) {
                    Text(cell.0)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(FateTheme.muted)
                    if !cell.2.isEmpty {
                        Image(systemName: cell.2)
                            .font(.system(size: 28, weight: .light))
                            .foregroundStyle(FateTheme.gold)
                    } else {
                        Text(cell.1)
                            .font(.system(size: 14, weight: index == 4 ? .semibold : .medium, design: .serif))
                            .foregroundStyle(FateTheme.ink)
                            .multilineTextAlignment(.center)
                            .lineLimit(3)
                            .minimumScaleFactor(0.78)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 88)
                .padding(.horizontal, 5)
                .background(index == 4 ? FateTheme.gold.opacity(0.13) : FateTheme.gold.opacity(0.045))
            }
        }
        .background(FateTheme.line)
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(FateTheme.line))
    }

    private func compactGrid(rows: [(label: String, value: String)]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                VStack(alignment: .leading, spacing: 4) {
                    Text(row.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(FateTheme.muted)
                    Text(row.value)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(FateTheme.ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                }
                .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .background(FateTheme.gold.opacity(0.055))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func elementBalanceView(rows: [(label: String, value: String)]) -> some View {
        let maximum = max(rows.compactMap { Double($0.value) }.max() ?? 1, 1)
        return VStack(spacing: 10) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                let score = Double(row.value) ?? 0
                HStack(spacing: 10) {
                    Text(row.label).font(.system(size: 14, weight: .medium)).frame(width: 20)
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(FateTheme.gold.opacity(0.10))
                            Capsule().fill(FateTheme.gold.opacity(0.72))
                                .frame(width: max(score > 0 ? 4 : 0, geometry.size.width * score / maximum))
                        }
                    }.frame(height: 8)
                    Text(row.value).font(.system(size: 13, design: .monospaced)).foregroundStyle(FateTheme.muted).frame(width: 38, alignment: .trailing)
                }
            }
        }.padding(.vertical, 2)
    }

    @ViewBuilder
    private func tableHeader(_ values: [String]) -> some View {
        HStack(spacing: 0) {
            if values.count == 2 {
                Text(values[0]).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 112).frame(minHeight: 38).overlay(alignment: .trailing) { Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1) }
                Text(values[1]).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 38)
            } else {
                ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                    Text(value).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 38, alignment: .center)
                        .overlay(alignment: .trailing) { if index < values.count - 1 { Rectangle().fill(Color.white.opacity(0.25)).frame(width: 1) } }
                }
            }
        }.background(FateTheme.gold)
    }

    @ViewBuilder
    private func tableRow(_ values: [String], shaded: Bool) -> some View {
        HStack(alignment: .top, spacing: 0) {
            if values.count == 2 {
                Text(values[0]).font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
                    .padding(.vertical, 10).padding(.horizontal, 9).frame(width: 112, alignment: .topLeading)
                    .overlay(alignment: .trailing) { Rectangle().fill(FateTheme.line).frame(width: 1) }
                Text(values[1]).font(.system(size: 14)).foregroundStyle(FateTheme.ink).fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 10).padding(.horizontal, 9).frame(maxWidth: .infinity, alignment: .topLeading)
            } else {
                ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                    Text(value).font(.system(size: 12)).foregroundStyle(FateTheme.ink).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .topLeading).padding(.vertical, 9).padding(.horizontal, 5)
                        .overlay(alignment: .trailing) { if index < values.count - 1 { Rectangle().fill(FateTheme.line).frame(width: 1) } }
                }
            }
        }.background(shaded ? FateTheme.gold.opacity(0.045) : Color.clear)
            .overlay(alignment: .bottom) { Rectangle().fill(FateTheme.line).frame(height: 1) }
    }

    private func conciseRows(for key: String, value: Any) -> [(label: String, value: String)] {
        if key == "elementBalance", let dictionary = value as? [String: Any], let scores = dictionary["scores"] as? [String: Any] {
            return ["木", "火", "土", "金", "水"].compactMap { element in
                scores[element].map { (element, displayValue($0)) }
            }
        }
        if key == "sanmeiChart", let dictionary = value as? [String: Any] {
            var rows: [(String, String)] = []
            if let chart = dictionary["bodyChart"] as? [String: Any] {
                for position in ["north", "west", "center", "east", "south"] {
                    guard let item = chart[position] as? [String: Any] else { continue }
                    rows.append((displayLabel(position), String(describing: item["star"] ?? "—")))
                }
            }
            if let stars = dictionary["subordinateStars"] as? [String: Any] {
                for period in ["early", "middle", "late"] {
                    guard let item = stars[period] as? [String: Any] else { continue }
                    let star = String(describing: item["star"] ?? "—")
                    let stage = String(describing: item["stage"] ?? "")
                    rows.append((displayLabel(period), stage.isEmpty ? star : "\(star)（\(stage)）"))
                }
            }
            return rows
        }
        if key == "sanmeiRelations", let dictionary = value as? [String: Any], let relations = dictionary["relations"] as? [[String: Any]] {
            return relations.prefix(8).map { relation in
                let branches = String(describing: relation["branches"] ?? "—")
                let name = String(describing: relation["relation"] ?? "関係")
                return ("\(branches)・\(name)", String(describing: relation["meaning"] ?? "—"))
            }
        }
        if key == "ziwei", let dictionary = value as? [String: Any] {
            var rows: [(String, String)] = []
            for field in ["fiveElementsClass", "soul", "body", "lunarDate", "timeRange"] {
                if let item = dictionary[field], !(item is NSNull) { rows.append((displayLabel(field), displayValue(item))) }
            }
            if let palaces = dictionary["palaces"] as? [[String: Any]] {
                for palace in palaces where ["命宮", "夫妻", "官禄", "財帛"].contains(String(describing: palace["name"] ?? "")) {
                    let stars = (palace["majorStars"] as? [[String: Any]] ?? []).map { String(describing: $0["name"] ?? "") }.filter { !$0.isEmpty }
                    rows.append((String(describing: palace["name"] ?? "宮"), stars.isEmpty ? "主星なし" : stars.joined(separator: "・")))
                }
            }
            return rows
        }
        if key == "astrology", let dictionary = value as? [String: Any] {
            var rows: [(String, String)] = []
            for system in ["western", "vedic"] {
                guard let chart = dictionary[system] as? [String: Any] else { continue }
                let systemName = system == "western" ? "西洋" : "インド"
                if let asc = chart["ascendant"] as? [String: Any] { rows.append(("\(systemName) ASC", "\(asc["sign"] ?? "—") \(displayValue(asc["degree"] ?? 0))°")) }
                for planet in (chart["planets"] as? [[String: Any]] ?? []).filter({ ["太陽", "月", "金星", "火星", "木星", "土星"].contains(String(describing: $0["name"] ?? "")) }) {
                    rows.append(("\(systemName) \(planet["name"] ?? "天体")", "\(planet["sign"] ?? "—") \(displayValue(planet["degree"] ?? 0))°\((planet["retrograde"] as? Bool) == true ? "・逆行" : "")"))
                }
            }
            return rows
        }
        return flatten(value).filter { row in
            !row.label.contains("年運") && !row.label.contains("長期運") && !row.label.contains("signals") &&
            !row.label.contains("key") && !row.value.isEmpty
        }.prefix(16).map { $0 }
    }

    private func flatten(_ value: Any, path: [String] = []) -> [(label: String, value: String)] {
        if let dictionary = value as? [String: Any] {
            let hiddenKeys: Set<String> = ["key", "label", "signals", "longitude", "annual", "decadal"]
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
