import SwiftUI

struct InsightHubView: View {
    let report: GeneratedReport
    let onQuestion: (ReadingCard) -> Void
    @State private var selectedKind = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text("FATE LAB · PERSONAL READING").font(.caption).tracking(2.2).foregroundStyle(FateTheme.gold)
                Text("あなたの鑑定").font(.system(size: 30, weight: .medium, design: .serif))
                Text("気になるカードから読み進められます。")
                    .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
            }
            Picker("表示", selection: $selectedKind) {
                Text("あなたの本質").tag(0)
                Text("時期の流れ").tag(1)
                Text("命式詳細").tag(2)
            }.pickerStyle(.segmented)
            if selectedKind == 2 {
                ChartDetailsView(report: report)
            } else {
                ForEach(filteredItems) { item in
                    NavigationLink { InsightDetailView(item: item) { onQuestion(item) } } label: { InsightCard(item: item) }
                        .buttonStyle(.plain)
                }
            }
        }
        .padding(20).background(FateTheme.paper).clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(FateTheme.line))
    }

    private var filteredItems: [ReadingCard] {
        let matching = report.cards.filter { selectedKind == 0 ? !$0.isTiming : $0.isTiming }
        return matching.isEmpty ? report.cards : matching
    }
}

private struct ChartDetailsView: View {
    let report: GeneratedReport

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("命式・計算データ").font(.system(size: 24, weight: .medium, design: .serif))
            VStack(alignment: .leading, spacing: 5) {
                if let date = report.birthData["birthDate"] as? String { Text(date.replacingOccurrences(of: "-", with: "/") + " 生") }
                if let place = report.birthData["birthplace"] as? String { Text(place) }
                if let gender = report.birthData["gender"] as? String { Text(gender == "female" ? "女性" : "男性") }
            }.font(.footnote).foregroundStyle(FateTheme.muted)
            Text(formattedData).font(.system(size: 13, design: .monospaced)).lineSpacing(6).textSelection(.enabled)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.ivory)
        .clipShape(RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }

    private var formattedData: String {
        guard JSONSerialization.isValidJSONObject(report.calculatedData),
              let data = try? JSONSerialization.data(withJSONObject: report.calculatedData, options: [.prettyPrinted, .sortedKeys]),
              let value = String(data: data, encoding: .utf8) else { return "計算データを表示できません" }
        return value
    }
}

private struct InsightCard: View {
    let item: ReadingCard
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack { Spacer(); Image(systemName: "arrow.up.right").foregroundStyle(FateTheme.gold) }
            Text(item.title).font(.system(size: 23, weight: .semibold, design: .serif)).foregroundStyle(FateTheme.ink)
            if let period = item.period { Text(period.label).font(.caption).foregroundStyle(FateTheme.muted) }
            Text(item.summary).font(.subheadline).foregroundStyle(FateTheme.muted).lineLimit(3).lineSpacing(4)
            FlowTags(tags: item.tags)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.ivory)
        .clipShape(RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line.opacity(0.75)))
    }
}

struct InsightDetailView: View {
    let item: ReadingCard
    let onQuestion: () -> Void
    @State private var focusMode = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text(item.title).font(.system(size: 35, weight: .medium, design: .serif)).lineSpacing(6)
                Text(item.summary).font(.system(size: 18, design: .serif)).foregroundStyle(FateTheme.muted).lineSpacing(8)
                FlowTags(tags: item.tags)
                Divider().overlay(FateTheme.line)
                ForEach(Array(item.pages.enumerated()), id: \.offset) { _, page in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(page.label).font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
                        Text(page.text).font(.system(size: 17)).lineSpacing(9)
                    }
                }
                Button("スワイプして深く読む") { focusMode = true }.buttonStyle(OutlineGoldButtonStyle())
                ShareLink(item: "Fate Labの鑑定「\(item.title)」\n\(item.summary)\nhttps://fate-lab.com") {
                    Label("この鑑定を共有", systemImage: "square.and.arrow.up")
                }.buttonStyle(OutlineGoldButtonStyle())
                Button("さらに詳しく質問する", action: onQuestion).buttonStyle(GoldButtonStyle())
                Text("共有内容に生年月日は含まれません。").font(.caption).foregroundStyle(FateTheme.muted).frame(maxWidth: .infinity)
            }.padding(28)
        }.background(FateTheme.ivory).navigationTitle(item.title).navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $focusMode) { FocusReadingView(item: item, onQuestion: onQuestion) }
    }
}

private struct FocusReadingView: View {
    @Environment(\.dismiss) private var dismiss
    let item: ReadingCard
    let onQuestion: () -> Void
    @State private var selection = 0

    var body: some View {
        ZStack {
            FateTheme.ivory.ignoresSafeArea()
            VStack(spacing: 0) {
                Text(item.title).font(.system(size: 20, weight: .medium, design: .serif))
                    .multilineTextAlignment(.center).padding(.top, 18).padding(.horizontal, 60)
                TabView(selection: $selection) {
                    ForEach(Array(item.pages.enumerated()), id: \.offset) { index, page in
                        VStack(spacing: 28) {
                            Spacer(minLength: 70)
                            Text(page.label).font(.caption).tracking(3).foregroundStyle(FateTheme.muted)
                            Text(page.text).font(.system(size: 23, weight: .medium, design: .serif)).lineSpacing(14)
                                .multilineTextAlignment(.center).frame(maxWidth: 330)
                            if let note = page.note {
                                Text(note).font(.system(size: 14)).foregroundStyle(FateTheme.muted).lineSpacing(6)
                                    .multilineTextAlignment(.center).frame(maxWidth: 310)
                            }
                            Spacer(minLength: 90)
                        }.padding(.horizontal, 26).tag(index).accessibilityElement(children: .combine)
                            .accessibilityLabel("\(item.pages.count)枚中\(index + 1)枚目。\(page.label)。\(page.text)")
                    }
                }.tabViewStyle(.page(indexDisplayMode: .never))
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(FateTheme.line)
                        Capsule().fill(FateTheme.ink).frame(width: geometry.size.width * progress)
                    }
                }.frame(height: 4).padding(.horizontal, 70).padding(.bottom, 28)
                Text(selection == item.pages.count - 1 ? "ここまで読んだら、気になる点をそのまま質問できます" : "左右にスワイプして、続きを読み進める")
                    .font(.caption).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).padding(.bottom, 24)
            }
            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .medium)).foregroundStyle(FateTheme.ink)
                            .frame(width: 46, height: 46).background(FateTheme.paper)
                            .overlay(Rectangle().stroke(FateTheme.line, lineWidth: 0.5))
                    }
                    Spacer()
                }
                Spacer()
                HStack {
                    Spacer()
                    Button { dismiss(); onQuestion() } label: {
                        Text("聞く").font(.system(size: 12, weight: .medium, design: .serif)).frame(width: 46, height: 46)
                            .background(FateTheme.paper).overlay(Rectangle().stroke(FateTheme.gold, lineWidth: 0.5))
                    }.foregroundStyle(FateTheme.gold)
                }
            }.padding(18)
        }.preferredColorScheme(.light)
    }

    private var progress: CGFloat {
        guard !item.pages.isEmpty else { return 1 }
        return CGFloat(selection + 1) / CGFloat(item.pages.count)
    }
}

struct FlowTags: View {
    let tags: [String]
    var body: some View {
        HStack(spacing: 7) {
            ForEach(tags.prefix(4), id: \.self) { tag in
                Text("#\(tag)").font(.caption).foregroundStyle(FateTheme.gold).padding(.horizontal, 10).padding(.vertical, 6)
                    .background(FateTheme.gold.opacity(0.08)).clipShape(Capsule()).overlay(Capsule().stroke(FateTheme.line))
            }
        }
    }
}
