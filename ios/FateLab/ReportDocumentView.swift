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
                CalculatedDataChapterView(data: report.calculatedData, index: 1, total: readingChapters.count + 1)
            }
            ForEach(Array(readingChapters.enumerated()), id: \.element.id) { index, chapter in
                chapterLink(number: index + 2, title: chapter.title, detail: chapter.detail) {
                    ReportChapterView(chapter: chapter, index: index + 2, total: readingChapters.count + 1)
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
                    ForEach(Array(chapter.nodes.enumerated()), id: \.offset) { nodeIndex, node in
                        ReportNodeView(node: node)
                            .id(nodeIndex)
                            .onAppear {
                                guard restoredPosition else { return }
                                UserDefaults.standard.set(nodeIndex, forKey: positionKey)
                            }
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
}

struct ReportNodeView: View {
    let node: ReportNode
    var body: some View {
        switch node {
        case .subsection(let title):
            HStack(spacing: 10) { Rectangle().fill(FateTheme.gold).frame(width: 4); Text(title).font(.system(size: 19, weight: .medium, design: .serif)) }
                .padding(.top, 18).padding(.bottom, 4)
        case .paragraph(let inlines): InlineReportText(inlines: inlines)
        case .bullet(let inlines): HStack(alignment: .top, spacing: 10) { Text("・"); InlineReportText(inlines: inlines) }
        case .advice(let inlines):
            HStack(alignment: .top, spacing: 10) { Text("▸").foregroundStyle(FateTheme.gold); InlineReportText(inlines: inlines) }
                .padding(12).background(FateTheme.gold.opacity(0.06)).clipShape(RoundedRectangle(cornerRadius: 10))
        case .evidence(let groups): EvidenceDisclosureView(evidence: groups)
        case .year(let year): YearCardView(year: year)
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
        } label: { Text("この読み解きの根拠").font(.system(size: 15, weight: .medium, design: .serif)) }
            .padding(14).background(FateTheme.gold.opacity(0.045)).clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct CalculatedDataChapterView: View {
    let data: [String: Any]
    let index: Int
    let total: Int
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(spacing: 12) {
                    Text("第 一 章").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                    Text("命式・計算データ").font(.system(size: 27, weight: .medium, design: .serif))
                    Text("9つの占術から算出した生データを省略せず表示します。").font(.caption).foregroundStyle(FateTheme.muted)
                }.frame(maxWidth: .infinity).padding(.vertical, 26)
                ReportCard { Text(prettyJSON).font(.system(size: 13, design: .monospaced)).textSelection(.enabled) }
            }.padding(20)
        }.background(FateTheme.ivory).navigationTitle("命式・計算データ").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Text("1 / \(total)").font(.caption).foregroundStyle(FateTheme.muted) } }
    }
    private var prettyJSON: String {
        guard JSONSerialization.isValidJSONObject(data), let raw = try? JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted, .sortedKeys]) else { return "計算データを表示できませんでした。" }
        return String(decoding: raw, as: UTF8.self)
    }
}

private func japaneseNumber(_ value: Int) -> String {
    let values = ["〇","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"]
    return values.indices.contains(value) ? values[value] : String(value)
}
