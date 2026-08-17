import SwiftUI

struct InsightHubView: View {
    let report: GeneratedReport
    let onQuestion: () -> Void
    @State private var selectedKind = 0

    private var items: [ReportInsight] { ReportInsight.make(from: report.text) }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text("FATE LAB · PERSONAL READING").font(.caption).tracking(2.2).foregroundStyle(FateTheme.gold)
                Text("あなたの鑑定").font(.system(size: 30, weight: .medium, design: .serif))
                Text("気になるカードから読み進められます。詳しい命式鑑定書も、この下にすべて残しています。")
                    .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
            }

            Picker("表示", selection: $selectedKind) {
                Text("あなたの本質").tag(0)
                Text("時期の流れ").tag(1)
            }.pickerStyle(.segmented)

            ForEach(filteredItems) { item in
                NavigationLink {
                    InsightDetailView(item: item, allItems: filteredItems, onQuestion: onQuestion)
                } label: {
                    InsightCard(item: item)
                }.buttonStyle(.plain)
            }
        }
        .padding(20)
        .background(FateTheme.paper)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(FateTheme.line))
    }

    private var filteredItems: [ReportInsight] {
        let matching = items.filter { selectedKind == 0 ? !$0.isTiming : $0.isTiming }
        return matching.isEmpty ? items : matching
    }
}

private struct InsightCard: View {
    let item: ReportInsight
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                Text(item.category.uppercased()).font(.caption2).tracking(1.5).foregroundStyle(FateTheme.gold)
                Spacer()
                Image(systemName: "arrow.up.right").foregroundStyle(FateTheme.gold)
            }
            Text(item.title).font(.system(size: 23, weight: .semibold, design: .serif)).foregroundStyle(FateTheme.ink)
            Text(item.summary).font(.subheadline).foregroundStyle(FateTheme.muted).lineLimit(3).lineSpacing(4)
            FlowTags(tags: item.tags)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(FateTheme.ivory)
        .clipShape(RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line.opacity(0.75)))
    }
}

struct InsightDetailView: View {
    let item: ReportInsight
    let allItems: [ReportInsight]
    let onQuestion: () -> Void
    @State private var focusMode = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text(item.category.uppercased()).font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
            Text(item.displayName).font(.system(size: 35, weight: .medium, design: .serif)).lineSpacing(6)
                FlowTags(tags: item.tags)
                Divider().overlay(FateTheme.line)
                Text(item.body).font(.system(size: 17)).lineSpacing(9)
                Button("スワイプして深く読む") { focusMode = true }.buttonStyle(OutlineGoldButtonStyle())
                ShareLink(item: "Fate Labの鑑定「\(item.title)」\n\(item.summary)\nhttps://fate-lab.com") {
                    Label("この鑑定を共有", systemImage: "square.and.arrow.up")
                }.buttonStyle(OutlineGoldButtonStyle())
                Button("さらに詳しく質問する", action: onQuestion).buttonStyle(GoldButtonStyle())
                Text("共有内容に生年月日は含まれません。").font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
            }.padding(28)
        }.background(FateTheme.ivory).navigationTitle(item.category).navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $focusMode) { FocusReadingView(item: item, onQuestion: onQuestion) }
    }
}

private struct FocusReadingView: View {
    @Environment(\.dismiss) private var dismiss
    let item: ReportInsight
    let onQuestion: () -> Void
    @State private var selection = 0

    var body: some View {
        ZStack {
            FateTheme.ivory.ignoresSafeArea()

            VStack(spacing: 0) {
                VStack(spacing: 7) {
                    Text(item.displayName)
                        .font(.system(size: 20, weight: .medium, design: .serif))
                        .multilineTextAlignment(.center)
                    Text(item.category)
                        .font(.caption)
                        .tracking(1.5)
                        .foregroundStyle(FateTheme.muted)
                }
                .padding(.top, 18)

                TabView(selection: $selection) {
                    ForEach(Array(item.storyCards.enumerated()), id: \.offset) { index, card in
                        VStack(spacing: 28) {
                            Spacer(minLength: 70)
                            Text(card.label)
                                .font(.caption)
                                .tracking(3)
                                .foregroundStyle(FateTheme.muted)
                            Text(card.text)
                                .font(.system(size: index == item.storyCards.count - 1 ? 20 : 23, weight: .medium, design: .serif))
                                .lineSpacing(14)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 330)
                            if let note = card.note {
                                Text(note)
                                    .font(.system(size: 14))
                                    .foregroundStyle(FateTheme.muted)
                                    .lineSpacing(6)
                                    .multilineTextAlignment(.center)
                                    .frame(maxWidth: 310)
                            }
                            Spacer(minLength: 90)
                        }
                        .padding(.horizontal, 26)
                        .tag(index)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(item.storyCards.count)枚中\(index + 1)枚目。\(card.label)。\(card.text)")
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                HStack(spacing: 7) {
                    ForEach(item.storyCards.indices, id: \.self) { index in
                        Circle()
                            .fill(index == selection ? FateTheme.ink : FateTheme.line)
                            .frame(width: 6, height: 6)
                    }
                }
                .padding(.bottom, 28)

                Text(selection == item.storyCards.count - 1 ? "ここまで読んだら、気になる点をそのまま質問できます" : "左右にスワイプして、続きを読み進める")
                    .font(.caption)
                    .foregroundStyle(FateTheme.muted)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 24)
            }

            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(FateTheme.ink)
                            .frame(width: 46, height: 46)
                            .background(FateTheme.paper)
                            .overlay(Rectangle().stroke(FateTheme.line, lineWidth: 0.5))
                    }
                    Spacer()
                }
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 11) {
                        ShareLink(item: "Fate Labの鑑定「\(item.displayName)」\n\(item.summary)\nhttps://fate-lab.com") {
                            Image(systemName: "bookmark")
                                .frame(width: 46, height: 46)
                                .background(FateTheme.paper)
                                .overlay(Rectangle().stroke(FateTheme.gold, lineWidth: 0.5))
                        }
                        Button {
                            dismiss()
                            onQuestion()
                        } label: {
                            Text("聞く")
                                .font(.system(size: 12, weight: .medium, design: .serif))
                                .frame(width: 46, height: 46)
                                .background(FateTheme.paper)
                                .overlay(Rectangle().stroke(FateTheme.gold, lineWidth: 0.5))
                        }
                    }
                    .foregroundStyle(FateTheme.gold)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 18)
        }
        .preferredColorScheme(.light)
    }
}

struct FlowTags: View {
    let tags: [String]
    var body: some View {
        HStack(spacing: 7) {
            ForEach(tags.prefix(4), id: \.self) { tag in
                Text("#\(tag)").font(.caption).foregroundStyle(FateTheme.gold).padding(.horizontal, 10).padding(.vertical, 6).background(FateTheme.gold.opacity(0.08)).clipShape(Capsule()).overlay(Capsule().stroke(FateTheme.line))
            }
        }
    }
}

struct ReportInsight: Identifiable {
    let id: String
    let category: String
    let title: String
    let summary: String
    let body: String
    let tags: [String]
    let isTiming: Bool
    let storyCards: [InsightStoryCard]

    var displayName: String { TraitLanguage.name(for: title, category: category) }

    static func make(from source: String) -> [ReportInsight] {
        let document = ReportParser.parse(source)
        var results: [ReportInsight] = []
        for chapter in document.chapters {
            let texts = chapter.nodes.compactMap(nodeText).filter { !$0.isEmpty }
            guard !texts.isEmpty else { continue }
            let timing = chapter.yearCount > 0 || chapter.title.contains("時期") || chapter.title.contains("年")
            let title = texts.first(where: { $0.count <= 46 }) ?? chapter.title
            let body = texts.joined(separator: "\n\n")
            let summary = texts.dropFirst().first ?? texts[0]
            let tags = tags(for: chapter.title + " " + body)
            let cleanedTitle = clean(title)
            let cleanedSummary = clean(summary)
            let cleanedBody = clean(body)
            let cards = TraitLanguage.cards(title: cleanedTitle, summary: cleanedSummary, texts: texts.map(clean))
            results.append(.init(id: chapter.id, category: chapter.title, title: cleanedTitle, summary: cleanedSummary, body: cleanedBody, tags: tags, isTiming: timing, storyCards: cards))
        }
        return Array(results.prefix(10))
    }

    private static func nodeText(_ node: ReportNode) -> String? {
        switch node {
        case .subsection(let value): return value
        case .paragraph(let values), .bullet(let values), .advice(let values): return values.map(\.plainText).joined()
        case .year(let year): return ([year.year, year.summary] + year.domains + year.body.compactMap(nodeText)).joined(separator: "　")
        case .evidence: return nil
        }
    }

    private static func clean(_ text: String) -> String { text.replacingOccurrences(of: "[[HIGHLIGHT:", with: "").replacingOccurrences(of: "]]", with: "") }
    private static func tags(for text: String) -> [String] {
        var values: [String] = []
        for (needle, label) in [("仕事", "仕事"),("恋", "恋愛"),("結婚", "結婚"),("人間関係", "人間関係"),("転職", "転職"),("挑戦", "挑戦"),("引越", "引越し")] where text.contains(needle) { values.append(label) }
        if values.isEmpty { values = ["本質", "自分らしさ"] }
        return Array(values.prefix(4))
    }
}

struct InsightStoryCard {
    let label: String
    let text: String
    let note: String?
}

private enum TraitLanguage {
    static func name(for title: String, category: String) -> String {
        let source = title + category
        if source.contains("言葉と情報") { return "話して確かめる人" }
        if source.contains("責任を現実") { return "引き受けたら最後まで" }
        if source.contains("人と人を調整") { return "間を取り持つ人" }
        if source.contains("自分から始め") { return "まず動いてみる人" }
        if source.contains("深く") || source.contains("探究") { return "奥まで確かめる人" }
        if source.contains("恋愛") || source.contains("結婚") { return "近くなるほど丁寧に" }
        if source.contains("仕事") { return "任された先で光る人" }
        if source.contains("人間関係") { return "距離を見ながら結ぶ人" }
        if source.contains("時期") || source.contains("年") { return "流れが動くとき" }
        if source.contains("組み合わせ") { return "いくつもの顔を持つ人" }
        if source.contains("要約") { return "最初に知ってほしいこと" }
        return title.replacingOccurrences(of: "力", with: "").prefixText(12)
    }

    static func cards(title: String, summary: String, texts: [String]) -> [InsightStoryCard] {
        let sentences = uniqueSentences(from: [summary] + texts)
        let labels = ["はじまり", "ふだんのあなた", "人といるとき", "心の内側", "つまずくとき", "試すなら"]
        var selected: [String] = []

        let action = sentences.last { sentence in
            ["してください", "すると", "試す", "決める", "確認する", "言葉にする", "手放す"].contains { sentence.contains($0) }
        }

        for sentence in sentences where selected.count < 6 {
            let normalized = readable(sentence)
            guard normalized.count >= 12,
                  !selected.contains(normalized),
                  normalized != title,
                  action.map({ readable($0) != normalized }) ?? true else { continue }
            selected.append(normalized)
        }

        if let action {
            if selected.count == 6 { selected.removeLast() }
            selected.append(readable(action))
        }

        if selected.isEmpty { selected = [readable(summary)] }
        while selected.count < 4, let last = selected.last {
            let supplements = [
                "この特徴は、何かを決める場面でいちばん輪郭が濃くなります。",
                "うまく使えているときは、無理に頑張らなくても自然に続けられます。",
                "大切なのは、正しさよりも自分が納得できる順番を見つけることです。"
            ]
            let next = supplements.first { !selected.contains($0) } ?? last
            selected.append(next)
        }

        return Array(selected.prefix(6)).enumerated().map { index, text in
            let label = index == min(selected.count, 6) - 1 ? "試すなら" : labels[min(index, labels.count - 1)]
            let note = index == 0 ? "読み進めるほど、この見立てが日常でどう表れるかが見えてきます。" : nil
            return .init(label: label, text: text, note: note)
        }
    }

    private static func uniqueSentences(from values: [String]) -> [String] {
        var result: [String] = []
        for value in values {
            let prepared = value
                .replacingOccurrences(of: "\n", with: "。")
                .replacingOccurrences(of: "- ", with: "")
            for piece in prepared.split(separator: "。") {
                let sentence = String(piece).trimmingCharacters(in: .whitespacesAndNewlines) + "。"
                guard sentence.count > 8, !result.contains(sentence) else { continue }
                result.append(sentence)
            }
        }
        return result
    }

    private static func readable(_ source: String) -> String {
        let text = source
            .replacingOccurrences(of: "[[HIGHLIGHT:", with: "")
            .replacingOccurrences(of: "]]", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return text
    }
}

private extension String {
    func prefixText(_ length: Int) -> String {
        count <= length ? self : String(prefix(length))
    }
}
