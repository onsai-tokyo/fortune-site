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
                Text(item.title).font(.system(size: 35, weight: .medium, design: .serif)).lineSpacing(6)
                FlowTags(tags: item.tags)
                Divider().overlay(FateTheme.line)
                Text(item.body).font(.system(size: 17)).lineSpacing(9)
                Button("1枚ずつ集中して読む") { focusMode = true }.buttonStyle(OutlineGoldButtonStyle())
                ShareLink(item: "Fate Labの鑑定「\(item.title)」\n\(item.summary)\nhttps://fate-lab.com") {
                    Label("この鑑定を共有", systemImage: "square.and.arrow.up")
                }.buttonStyle(OutlineGoldButtonStyle())
                Button("さらに詳しく質問する", action: onQuestion).buttonStyle(GoldButtonStyle())
                Text("共有内容に生年月日は含まれません。").font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
            }.padding(28)
        }.background(FateTheme.ivory).navigationTitle(item.category).navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $focusMode) { FocusReadingView(items: allItems, initialID: item.id) }
    }
}

private struct FocusReadingView: View {
    @Environment(\.dismiss) private var dismiss
    let items: [ReportInsight]
    @State private var selection: String
    init(items: [ReportInsight], initialID: String) { self.items = items; _selection = State(initialValue: initialID) }
    var body: some View {
        ZStack(alignment: .topLeading) {
            FateTheme.ivory.ignoresSafeArea()
            TabView(selection: $selection) {
                ForEach(items) { item in
                    VStack(spacing: 24) {
                        Spacer()
                        Text(item.category.uppercased()).font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
                        Text(item.title).font(.system(size: 30, weight: .medium, design: .serif)).multilineTextAlignment(.center)
                        Text(item.body).font(.system(size: 18)).lineSpacing(10).frame(maxWidth: 330, alignment: .leading)
                        Spacer()
                        Text("左右にスワイプして読み進める").font(.caption).foregroundStyle(FateTheme.muted)
                    }.padding(30).tag(item.id)
                }
            }.tabViewStyle(.page(indexDisplayMode: .always))
            Button { dismiss() } label: { Image(systemName: "xmark").font(.title3).foregroundStyle(FateTheme.ink).padding(14).background(FateTheme.paper).clipShape(Circle()) }.padding(22)
        }
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

    static func make(from source: String) -> [ReportInsight] {
        let document = ReportParser.parse(source)
        var results: [ReportInsight] = []
        for chapter in document.chapters {
            let texts = chapter.nodes.compactMap(nodeText).filter { !$0.isEmpty }
            guard !texts.isEmpty else { continue }
            let timing = chapter.yearCount > 0 || chapter.title.contains("時期") || chapter.title.contains("年")
            let title = texts.first(where: { $0.count <= 46 }) ?? chapter.title
            let body = texts.prefix(5).joined(separator: "\n\n")
            let summary = texts.dropFirst().first ?? texts[0]
            let tags = tags(for: chapter.title + " " + body)
            results.append(.init(id: chapter.id, category: chapter.title, title: clean(title), summary: clean(summary), body: clean(body), tags: tags, isTiming: timing))
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
