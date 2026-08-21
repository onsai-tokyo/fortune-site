import SwiftUI

struct InsightHubView: View {
    let report: GeneratedReport
    let onQuestion: (ReadingCard) -> Void
    var onReload: (() -> Void)? = nil
    @State private var selectedTab = "essence"

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text("あなたの取扱説明書").font(FateType.screenTitle)
                Text("本質、時期、命式を行き来しながら読み進める")
                    .font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(4)
            }

            Picker("鑑定書の表示", selection: $selectedTab) {
                Text("あなたの本質").tag("essence")
                Text("時期の流れ").tag("timing")
                Text("命式詳細").tag("chart")
            }
            .pickerStyle(.segmented)

            if selectedTab == "chart" {
                ChartDetailsView(report: report, onQuestion: onQuestion, onReload: onReload)
            } else if selectedTab == "essence" {
                LazyVGrid(columns: essenceColumns, alignment: .leading, spacing: 12) {
                    ForEach(report.cards.filter { $0.resolvedTab == "essence" }) { item in
                        NavigationLink { InsightDetailView(item: item) { onQuestion(item) } } label: { EssenceCard(item: item) }
                            .buttonStyle(.plain)
                    }
                }
            } else {
                ForEach(report.cards.filter { $0.resolvedTab == selectedTab }) { item in
                    NavigationLink { InsightDetailView(item: item) { onQuestion(item) } } label: { InsightCard(item: item) }
                        .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, FateSpacing.screenH).background(FateTheme.canvas)
    }

    private var essenceColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    }
}

private struct ChartDetailsView: View {
    let report: GeneratedReport
    let onQuestion: (ReadingCard) -> Void
    let onReload: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            FLSectionHeader(title: "命式の詳細")
            VStack(alignment: .leading, spacing: 5) {
                if let date = report.birthData["birthDate"] as? String { Text(date.replacingOccurrences(of: "-", with: "/") + " 生") }
                if let place = report.birthData["birthplace"] as? String { Text(place) }
                if let gender = report.birthData["gender"] as? String { Text(gender == "female" ? "女性" : "男性") }
            }.font(.footnote).foregroundStyle(FateTheme.muted)
            if chartCards.isEmpty {
                if let onReload {
                    FLErrorState(title: "命式データを読み込めませんでした", message: "通信状態を確認して、もう一度読み込んでください。", retry: onReload)
                } else {
                    FLEmptyState(title: "命式データがありません", message: "この鑑定では命式の詳細を表示できません。")
                }
            } else {
                ForEach(chartCards) { item in
                    NavigationLink { InsightDetailView(item: item) { onQuestion(item) } } label: { ChartCard(item: item) }
                        .buttonStyle(.plain)
                }
            }
        }
        .padding(FateSpacing.cardPadding).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.canvas)
        .clipShape(RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }

    private var chartCards: [ReadingCard] { report.cards.filter { $0.resolvedTab == "chart" } }
}

private struct ChartCard: View {
    let item: ReadingCard
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(item.title).font(.system(size: 18, weight: .semibold)).foregroundStyle(FateTheme.ink)
                Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted)
            }
            Text(item.summary).font(.system(size: 14)).foregroundStyle(FateTheme.body).lineSpacing(5)
            FlowTags(tags: item.tags)
        }
        .padding(18).background(FateTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line))
    }
}

private struct InsightCard: View {
    let item: ReadingCard
    var body: some View {
        FLListRow(title: item.title, subtitle: item.summary)
    }
}

private struct EssenceCard: View {
    let item: ReadingCard

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 8) {
                Text(item.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(FateTheme.ink)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(FateTheme.muted)
            }
            Text(item.summary)
                .font(.system(size: 13))
                .foregroundStyle(FateTheme.body)
                .lineSpacing(4)
                .lineLimit(3)
            Spacer(minLength: 0)
            EssenceTags(tags: item.tags)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 210, alignment: .topLeading)
        .background(FateTheme.canvas)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct EssenceTags: View {
    let tags: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(tags.prefix(2), id: \.self) { tag in
                Text("#\(tag)")
                    .font(.system(size: 11))
                    .foregroundStyle(FateTheme.muted)
                    .lineLimit(1)
            }
        }
    }
}

struct InsightDetailView: View {
    let item: ReadingCard
    let onQuestion: () -> Void
    @State private var focusMode = false

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Spacer()
            Text(item.title).font(.system(size: 32, weight: .bold)).lineSpacing(6)
            Text(item.summary).font(.system(size: 18)).foregroundStyle(FateTheme.body).lineSpacing(8)
            Spacer()
            Button("このページを読む →") { focusMode = true }.buttonStyle(FLPrimaryButtonStyle())
            DisclosureGroup("この読みの手がかり") { ForEach(item.evidence, id: \.detail) { Text($0.detail).font(.footnote).foregroundStyle(FateTheme.muted) } }.tint(FateTheme.ink)
        }.padding(28).background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
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
            FateTheme.canvas.ignoresSafeArea()
            VStack(spacing: 0) {
                Text(item.title).font(.system(size: 20, weight: .medium))
                    .multilineTextAlignment(.center).padding(.top, 18).padding(.horizontal, 60)
                TabView(selection: $selection) {
                    ForEach(Array(item.pages.enumerated()), id: \.offset) { index, page in
                        VStack(spacing: 28) {
                            Spacer(minLength: 70)
                            Text(page.label).font(.caption).tracking(3).foregroundStyle(FateTheme.muted)
                            Text(page.text).font(.system(size: 23, weight: .medium)).lineSpacing(14)
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
                Text("\(selection + 1) / \(item.pages.count)")
                    .font(.caption).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).padding(.bottom, 24)
            }
            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .medium)).foregroundStyle(FateTheme.ink)
                            .frame(width: 46, height: 46).background(FateTheme.surface)
                            .overlay(Rectangle().stroke(FateTheme.line, lineWidth: 0.5))
                    }
                    Spacer()
                }
                Spacer()
                if selection == item.pages.count - 1 { Button("このことを聞いてみる") { dismiss(); onQuestion() }.buttonStyle(FLPrimaryButtonStyle()) }
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
                Text("#\(tag)").font(.caption).foregroundStyle(FateTheme.ink).padding(.horizontal, 10).padding(.vertical, 6)
                    .background(FateTheme.ink.opacity(0.08)).clipShape(Capsule()).overlay(Capsule().stroke(FateTheme.line))
            }
        }
    }
}
