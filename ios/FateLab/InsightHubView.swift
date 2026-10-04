import SwiftUI

struct InsightHubView: View {
    enum Scope { case `self`, couple }
    let report: GeneratedReport
    var scope: Scope = .self
    let onQuestion: (ReadingCard) -> Void
    var onReload: (() -> Void)? = nil
    var isPartner = false
    @State private var selectedTab = "essence"

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            FateEditorialHero(eyebrow: scope == .couple ? "RELATIONSHIP" : "YOUR READING", title: scope == .couple ? "二人の関係性" : isPartner ? "あの人の取扱説明書" : "あなたの取扱説明書", subtitle: scope == .couple ? "二人の違いと重なりから、関係を見つめる。" : "自分らしさと、これからの流れを。")

            ScrollView(.horizontal) { HStack(spacing: 4) {
                ForEach(scope == .couple ? ["partner", "essence", "timing", "chart"] : ["essence", "timing", "chart"], id: \.self) { tab in
                    Button { selectedTab = tab } label: {
                        Text(tab == "partner" ? "あの人について" : tab == "essence" ? (scope == .couple ? "二人の関係" : isPartner ? "あの人の本質" : "あなたの本質") : tab == "timing" ? (scope == .couple ? "二人の節目" : "時期の流れ") : "命式詳細")
                            .font(.subheadline.weight(selectedTab == tab ? .semibold : .regular))
                            .fixedSize(horizontal: true, vertical: false).padding(.horizontal, 14).frame(minHeight: 44)
                            .foregroundStyle(selectedTab == tab ? FateTheme.ink : FateTheme.muted)
                            .background(selectedTab == tab ? FateTheme.card : .clear, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
                }
            }.padding(5).background(FateTheme.surface.opacity(0.75), in: RoundedRectangle(cornerRadius: 16)) }.scrollIndicators(.hidden)

            if selectedTab == "partner", let id = report.conversationID {
                PartnerReadingView(conversationID: id).id(id)
            } else if selectedTab == "chart" {
                if scope == .couple {
                    CoupleChartDetailsView(sections: report.chartSections, partnerName: "相手")
                } else {
                    ChartDetailsView(report: report, onQuestion: onQuestion, onReload: onReload)
                }
            } else {
                let cards = report.cards.filter {
                    $0.resolvedTab == selectedTab && $0.scope == (scope == .couple ? "couple" : "self")
                }
                if scope == .couple, selectedTab == "timing" {
                    CoupleTimingList(cards: cards, conversationID: report.conversationID, onQuestion: onQuestion)
                } else if scope == .self, selectedTab == "timing" {
                    SelfTimingList(cards: cards, conversationID: report.conversationID, onQuestion: onQuestion)
                        .id(report.conversationID)
                } else {
                    ReadingCardList(cards: cards, onQuestion: onQuestion)
                }
            }
        }
        .padding(.vertical, FateSpacing.screenH).background(FateTheme.canvas)
    }

    private func relationshipOrb(_ color: Color) -> some View {
        Circle().fill(RadialGradient(colors: [.white, color.opacity(0.65), color], center: .init(x: 0.35, y: 0.25), startRadius: 0, endRadius: 95))
            .overlay(FateMark(size: 38, color: .white.opacity(0.9)))
            .frame(width: 96, height: 96)
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
            if report.chartSections.isEmpty {
                if let onReload {
                    FLErrorState(title: "命式データを読み込めませんでした", message: "通信状態を確認して、もう一度読み込んでください。", retry: onReload)
                } else {
                    FLEmptyState(title: "命式データがありません", message: "この鑑定では命式の詳細を表示できません。")
                }
            } else {
                ForEach(report.chartSections) { section in
                    ChartSectionView(section: section)
                }
            }
        }
        .padding(FateSpacing.cardPadding).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.canvas)
        .clipShape(RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }
}

struct ChartSectionView: View {
    let section: ChartSection
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(section.system).font(.caption).tracking(2).foregroundStyle(FateTheme.muted)
                Text(section.title).font(.title3.weight(.medium)).foregroundStyle(FateTheme.ink)
            }
            if let table = section.table { ChartTableView(table: table) }
            if let bars = section.bars { ChartBarsView(bars: bars) }
            if let grid = section.grid { ChartGridView(items: grid) }
            if let list = section.list { ChartListView(items: list) }
            if let note = section.note { Text(note).font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4) }
        }
        .padding(18).background(FateTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line))
    }
}

private struct ChartTableView: View {
    let table: ChartTable
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 10) {
                GridRow { ForEach(Array(table.headers.enumerated()), id: \.offset) { _, value in Text(value).font(.caption).foregroundStyle(FateTheme.muted) } }
                Divider().gridCellUnsizedAxes(.horizontal)
                ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
                    GridRow { ForEach(Array(row.enumerated()), id: \.offset) { _, value in Text(value).font(.footnote).fixedSize() } }
                }
            }
        }
    }
}

private struct ChartBarsView: View {
    let bars: [ChartBar]
    var body: some View {
        VStack(spacing: 11) {
            ForEach(bars) { bar in
                HStack(spacing: 10) {
                    Text(bar.label).font(.system(size: 14, weight: .medium)).frame(width: 22)
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(FateTheme.line)
                            Capsule().fill(bar.isZero ? FateTheme.muted : FateTheme.ink).frame(width: bar.isZero ? 3 : geometry.size.width * CGFloat(bar.value / max(1, bar.max)))
                        }
                    }.frame(height: 7)
                    Text(bar.isZero ? "0  要補完" : String(format: "%.1f", bar.value)).font(.caption).foregroundStyle(bar.isZero ? FateTheme.danger : FateTheme.body).frame(width: 58, alignment: .trailing)
                }
            }
        }
    }
}

private struct ChartGridView: View {
    let items: [ChartGridItem]
    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.position).font(.caption).foregroundStyle(FateTheme.muted)
                    Text(item.value).font(.subheadline.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading).padding(12)
                    .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

private struct ChartListView: View {
    let items: [ChartListItem]
    var body: some View {
        VStack(spacing: 0) {
            ForEach(items) { item in
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.label).font(.caption).foregroundStyle(FateTheme.muted)
                        if let note = item.note { Text(note).font(.caption2).foregroundStyle(FateTheme.muted) }
                    }
                    Spacer(); Text(item.value).font(.subheadline.weight(.medium)).multilineTextAlignment(.trailing)
                }.padding(.vertical, 10).overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line), alignment: .bottom)
            }
        }
    }
}

struct ReadingCardList: View {
    @Environment(\.isPartnerReading) private var isPartnerReading
    let cards: [ReadingCard]
    let onQuestion: (ReadingCard) -> Void

    var body: some View {
        ForEach(Array(cards.enumerated()), id: \.element.id) { index, item in
            NavigationLink {
                FocusReadingView(item: item) { onQuestion(item) }
                    .environment(\.isPartnerReading, isPartnerReading)
            } label: {
                InsightCard(item: item, artworkIndex: index).contentShape(Rectangle())
            }.buttonStyle(.plain)
        }
    }
}

/// A single generated atlas supplies twelve distinct photographs. Cropping is
/// presentation only; no report value, ordering or evidence depends on artwork.
struct ReadingNatureArtwork: View {
    let index: Int
    private static let tiles: [UIImage] = {
        guard let source = UIImage(named: "ReadingNature")?.cgImage else { return [] }
        let width = source.width / 3, height = source.height / 4
        return (0..<12).compactMap { index in
            source.cropping(to: CGRect(x: (index % 3) * width, y: (index / 3) * height, width: width, height: height))
                .map { UIImage(cgImage: $0) }
        }
    }()
    var body: some View {
        GeometryReader { geometry in
            if !Self.tiles.isEmpty {
                Image(uiImage: Self.tiles[abs(index) % Self.tiles.count]).resizable().scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height).clipped()
            }
        }.accessibilityHidden(true).allowsHitTesting(false)
    }
}

struct InsightCard: View {
    let item: ReadingCard
    var artworkIndex = 0

    var body: some View {
        if item.isTiming {
            HStack(alignment: .top, spacing: 14) {
                VStack(spacing: 0) {
                    Circle().stroke(FateTheme.muted.opacity(0.6), lineWidth: 1).frame(width: 7, height: 7)
                    Rectangle().fill(FateTheme.line).frame(width: 1)
                }.frame(width: 8).padding(.top, 25)
                VStack(alignment: .leading, spacing: 14) {
                    if item.scope == "couple" {
                        Text("二人の年運の比較").font(.caption).foregroundStyle(FateTheme.muted)
                    }
                    Text(item.displayPeriodLabel ?? "時期の流れ").font(.system(.title3, weight: .semibold))
                    Text(item.title).font(.body.weight(.semibold)).lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                    TimelineTagList(tags: item.timelineDisplayTags)
                    Text(item.summary).font(.subheadline).foregroundStyle(FateTheme.muted).lineSpacing(5).lineLimit(3)
                    HStack { Spacer(); Label("この年を読む", systemImage: "arrow.right").font(.caption) }
                        .foregroundStyle(FateTheme.muted)
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(FateTheme.line.opacity(0.7), lineWidth: 0.5))
            }.foregroundStyle(FateTheme.ink)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Rectangle().fill(.white.opacity(0.65)).frame(width: 20, height: 1)
                    Text(item.tags.first(where: { $0 != "本質" }) ?? "あなたについて")
                        .font(.subheadline.weight(.medium)).tracking(0.8)
                        .accessibilityAddTraits(.isHeader)
                }
                .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
                Spacer(minLength: 12)
                Text(item.title).font(.system(.headline, weight: .medium)).lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 12)
                HStack { Text("読み進める").font(.caption); Spacer(); Image(systemName: "arrow.right") }
                    .padding(.top, 6)
            }.padding(24).frame(maxWidth: .infinity, minHeight: 204, alignment: .leading)
                .foregroundStyle(.white)
                .background {
                    ReadingNatureArtwork(index: artworkIndex)
                        .overlay(LinearGradient(colors: [.black.opacity(0.60), .black.opacity(0.30), .black.opacity(0.82)], startPoint: .top, endPoint: .bottom))
                }.clipShape(RoundedRectangle(cornerRadius: 22))
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

struct FocusReadingView: View {
    @Environment(\.isPartnerReading) private var isPartnerReading
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @AccessibilityFocusState private var focusedAnchor: String?
    @ScaledMetric(relativeTo: .title) private var coverTitleSize = 26
    @ScaledMetric(relativeTo: .title3) private var sectionTitleSize = 20
    @ScaledMetric(relativeTo: .body) private var bodySize = 17
    let item: ReadingCard
    let onQuestion: () -> Void

    private enum ReaderStyle {
        static let paper = Color(red: 250 / 255.0, green: 248 / 255.0, blue: 245 / 255.0)
        static let ink = Color(red: 17 / 255.0, green: 17 / 255.0, blue: 17 / 255.0)
        static let body = Color(red: 74 / 255.0, green: 74 / 255.0, blue: 74 / 255.0)
        static let line = Color(red: 232 / 255.0, green: 227 / 255.0, blue: 221 / 255.0)
        static let lilac = Color(red: 214 / 255.0, green: 201 / 255.0, blue: 255 / 255.0)
        static let blush = Color(red: 249 / 255.0, green: 239 / 255.0, blue: 236 / 255.0)
    }

    private struct Chapter: Identifiable {
        let id: Int
        let title: String
        let body: String
        let role: String
        let section: ReadingCardSection?
        var anchor: String { "reader-chapter-\(id)" }
    }

    private var chapters: [Chapter] {
        if let sections = item.displaySections, !sections.isEmpty {
            return sections.enumerated().map { index, section in
                Chapter(id: index, title: section.heading, body: section.body, role: "section", section: section)
            }
        }
        // Preserve the original order and wording of older saved reports too.
        return item.displayPages.enumerated().map { index, page in
            Chapter(id: index, title: page.label, body: page.text, role: page.role, section: nil)
        }
    }

    private var hasMultipleChapters: Bool { chapters.count > 1 }

    var body: some View {
        ScrollViewReader { proxy in
            VStack(spacing: 0) {
                readerHeader(proxy)
                ScrollView {
                    VStack(alignment: .leading, spacing: 32) {
                        VStack(alignment: .leading, spacing: 28) {
                            cover.id("reader-top")
                            ForEach(chapters) { chapter in
                                chapterView(chapter, proxy: proxy).id(chapter.anchor)
                            }
                        }
                        .padding(.horizontal, 28).padding(.top, 32).padding(.bottom, 116)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background {
                            ZStack(alignment: .bottom) {
                                FateArtwork(name: "QuietMountains")
                                ReaderStyle.paper.opacity(0.35)
                                FateArtwork(name: "QuietMountains").frame(height: 180)
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(ReaderStyle.paper.opacity(0.96))
                                    .padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 94)
                            }.accessibilityHidden(true)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                        .accessibilityIdentifier("reader.mountainSheet")
                        if !isPartnerReading { questionFooter }
                    }
                    .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 40)
                    .frame(maxWidth: 620, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .accessibilityIdentifier("reader.scroll")
            }
        }
        .background(ReaderStyle.paper.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .preferredColorScheme(.light)
    }

    private func readerHeader(_ proxy: ScrollViewProxy) -> some View {
        ZStack {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 15, weight: .medium))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }.accessibilityLabel("戻る").accessibilityIdentifier("reader.back")
                Spacer()

            }
            .buttonStyle(.plain)
            HStack(spacing: 7) {
                FateMark(size: 21, color: ReaderStyle.ink).accessibilityHidden(true)
                Text("FATE LAB").font(.system(size: 10, weight: .medium)).tracking(2.5)
            }.allowsHitTesting(false)
        }
        .foregroundStyle(ReaderStyle.ink)
        .padding(.horizontal, 12).padding(.vertical, 4)
        .background(ReaderStyle.paper)
    }

    private var cover: some View {
        VStack(alignment: .center, spacing: 16) {
            Text(item.isTiming ? "時期の鑑定" : item.scope == "couple" ? "ふたりの鑑定" : isPartnerReading ? "あの人の鑑定" : "あなたの鑑定")
                .font(.caption.weight(.medium)).padding(.horizontal, 10).padding(.vertical, 6)
                .background(.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 5))
            Text(item.title).font(.system(size: coverTitleSize, weight: .semibold))
                .lineSpacing(5).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            TimelineTagList(tags: item.timelineDisplayTags)
            if !item.tags.contains(item.summary.trimmingCharacters(in: .whitespacesAndNewlines)) { readerText(item.summary) }
            if let period = item.displayPeriodLabel {
                Text(period).font(.caption).foregroundStyle(ReaderStyle.body)
            }
        }
        .foregroundStyle(ReaderStyle.ink)
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private func chapterView(_ chapter: Chapter, proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            if hasMultipleChapters {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        if item.isTiming {
                            Circle().fill(ReaderStyle.paper).frame(width: 10, height: 10)
                                .overlay(Circle().stroke(ReaderStyle.lilac, lineWidth: 2))
                                .accessibilityHidden(true)
                        }
                        Text(String(format: "%02d", chapter.id + 1))
                            .font(.subheadline).foregroundStyle(ReaderStyle.body.opacity(0.7))
                            .accessibilityHidden(true)
                    }
                    Text(chapter.title).font(.system(size: sectionTitleSize, weight: .semibold))
                        .foregroundStyle(ReaderStyle.ink).lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("reader.heading.\(chapter.id)")
                        .accessibilityFocused($focusedAnchor, equals: chapter.anchor)
                }
            }
            readerText(chapter.body)
            if !item.isTiming, let section = chapter.section {
                SectionEvidenceView(section: section)
                    .tint(ReaderStyle.body)
            }
            if hasMultipleChapters { chapterNavigation(chapter, proxy: proxy) }
        }
    }

    private func chapterNavigation(_ chapter: Chapter, proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 12) {
            Button {
                jump(to: chapter.id == 0 ? "reader-top" : "reader-chapter-\(chapter.id - 1)", proxy: proxy)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                    Text(chapter.id == 0 ? "最初へ" : "前の章へ")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(ReaderStyle.line.opacity(0.6), in: Capsule())
                .foregroundStyle(ReaderStyle.ink)
            }
            .accessibilityIdentifier("reader.previous.\(chapter.id)")
            Button {
                jump(to: chapter.id == chapters.last?.id ? "reader-question" : "reader-chapter-\(chapter.id + 1)", proxy: proxy)
            } label: {
                HStack(spacing: 6) {
                    Text(chapter.id == chapters.last?.id ? "質問へ" : "次の章へ")
                    Image(systemName: "chevron.right")
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(ReaderStyle.ink, in: Capsule())
                .foregroundStyle(.white)
            }
            .accessibilityIdentifier("reader.next.\(chapter.id)")
        }
        .font(.subheadline.weight(.medium)).buttonStyle(.plain)
        .padding(.top, 4)
    }

    private var questionFooter: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("気になることを深掘り")
                .font(.headline).foregroundStyle(ReaderStyle.ink).accessibilityAddTraits(.isHeader)
                .accessibilityFocused($focusedAnchor, equals: "reader-question")
            Button { dismiss(); onQuestion() } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bubble.left").foregroundStyle(ReaderStyle.body)
                    Text("このことを聞いてみる")
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").font(.caption)
                }
                .font(.system(size: bodySize)).foregroundStyle(ReaderStyle.ink)
                .padding(16).frame(maxWidth: .infinity, minHeight: 52)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ReaderStyle.line, lineWidth: 0.5))
            }
            .buttonStyle(.plain).accessibilityIdentifier("reader.question")
        }
        .padding(.top, 8).id("reader-question")
    }

    private func readerText(_ text: String) -> some View {
        Text(text).font(.system(size: bodySize)).foregroundStyle(ReaderStyle.body)
            .lineSpacing(7).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func jump(to anchor: String, proxy: ScrollViewProxy) {
        if reduceMotion || voiceOverEnabled { proxy.scrollTo(anchor, anchor: .top) }
        else { withAnimation(.easeInOut(duration: 0.25)) { proxy.scrollTo(anchor, anchor: .top) } }
        focusedAnchor = anchor
    }
}

struct TimelineTagList: View {
    let tags: [String]
    private func tagColor(_ tag: String) -> Color {
        if tag.contains("婚期") || tag.contains("結びつき") { return .pink }
        if tag.contains("仕事") || tag.contains("活動") || tag.contains("進路") { return .blue }
        if tag.contains("住まい") { return .green }
        if tag.contains("見直す") || tag.contains("揺れ") || tag.contains("分かれ道") { return .orange }
        return .purple
    }
    var body: some View {
        if !tags.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(FateTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(tagColor(tag).opacity(0.13), in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
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

struct SelfTimingList: View {
    @EnvironmentObject private var auth: AuthStore
    let cards: [ReadingCard]
    let conversationID: UUID?
    let onQuestion: (ReadingCard) -> Void
    @State private var refreshedCards: [ReadingCard]?
    @State private var eventReadings: [LifeEventReading] = []
    @State private var eventError: String?
    @State private var history: SelfTimingHistory?
    @State private var showAll = false
    @State private var loading = false
    @State private var error: String?

    private var visibleCards: [ReadingCard] {
        let all = history.map { SelfTimingHistory.merging($0.cards, saved: refreshedCards ?? cards) } ?? (refreshedCards ?? cards).sorted { ($0.calendarYear ?? 0) < ($1.calendarYear ?? 0) }
        let start = Calendar(identifier: .gregorian).component(.year, from: Date()) - 5
        return showAll ? all : all.filter { $0.calendarYear.map { $0 >= start } ?? true }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let eventError { Text(eventError).font(.footnote).foregroundStyle(FateTheme.muted); Button("年表を再読み込み") { Task { await refreshTimeline(forceCards: true) } } }

            if conversationID != nil || cards.contains(where: { ($0.calendarYear ?? Int.max) < Calendar(identifier: .gregorian).component(.year, from: Date()) - 5 }) {
                Button(showAll ? "以前の年を折りたたむ" : "6年以上前の年も見る（18歳以降）") {
                    Task { await toggleHistory() }
                }.buttonStyle(FLSecondaryButtonStyle()).disabled(loading)
                if loading { FateInlineLoading(title: "年の流れを読み込んでいます") }
                if let error { Text(error).font(.footnote).foregroundStyle(FateTheme.muted) }
                if showAll {
                    Text("出生情報から読んだ年ごとのテーマを表示しています。実際の出来事の記録ではありません。")
                        .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
                }
            }
            ForEach(visibleCards) { card in
                ReadingCardList(cards: [card], onQuestion: onQuestion)
                ForEach(eventReadings.filter { $0.year == card.calendarYear }) { reading in EventReadingView(reading: reading) }
            }
        }.task(id: AccountScope(auth)) { await refreshTimeline() }
    }

    private func refreshTimeline(forceCards: Bool = false) async {
        guard let conversationID else { return }
        let owner = AccountScope(auth)
        do {
            async let readings = APIClient.shared.timelineCall(EventReadingsResponse.self, path: "/events/for-reading/" + conversationID.uuidString, auth: auth)
            // The parent already fetched the current cards. Refresh calculations
            // only after an edit, instead of requesting the same report twice.
            if forceCards {
                let result = try await APIClient.shared.cards(id: conversationID, auth: auth)
                try owner.check(auth)
                refreshedCards = result.cards.filter { $0.isTiming && $0.scope == "self" }
                history = nil
                if showAll { history = try await APIClient.shared.selfTimingHistory(id: conversationID, auth: auth) }
            }
            let events = try await readings
            try owner.check(auth); eventReadings = events.readings; eventError = nil
        } catch is CancellationError { }
        catch { if owner.isCurrent(auth) { eventError = userFacingErrorMessage(error) } }
    }

    private func toggleHistory() async {
        if showAll { showAll = false; return }
        if history != nil { showAll = true; return }
        guard !loading else { return }
        guard let conversationID else { showAll = true; return }
        let owner = AccountScope(auth)
        loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.selfTimingHistory(id: conversationID, auth: auth)
            try owner.check(auth)
            history = value; showAll = true
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "年の流れを追加できませんでした。表示中の年は引き続き読めます。もう一度お試しください。"
        }
    }
}

struct CoupleTimingList: View {
    @EnvironmentObject private var auth: AuthStore
    let cards: [ReadingCard]
    let conversationID: UUID?
    let onQuestion: (ReadingCard) -> Void
    @State private var history: CoupleAllYearsHistory?
    @State private var loadedConversationID: UUID?
    @State private var meetingYear = ""
    @State private var loading = false
    @State private var error: String?
    @State private var showPast = false
    @State private var openGroups: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("出会った年から、ふたりの流れを年ごとに読み解きます。")
                .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(5)
            if let history {
                if let note = history.relationshipContext?.note,
                   !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(note).font(.footnote).foregroundStyle(FateTheme.muted)
                        .lineSpacing(5).fixedSize(horizontal: false, vertical: true)
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 14))
                }
                if history.status == "needs_meeting_year" {
                    Text("相手のプロフィール画面で「出会った年」を設定すると、ふたりの時系列が表示されます。")
                        .font(.callout).foregroundStyle(FateTheme.muted)
                } else {
                    Text("\(history.meetingYear.map(String.init) ?? "")〜\(String(history.endYear))年・全\(history.entries.count)年")
                        .font(.caption).foregroundStyle(FateTheme.muted)
                    let collapsed = history.collapsibleYears
                    let hidden = Set(collapsed)
                    if hidden.isEmpty {
                        entries(history.entries)
                    } else {
                        entries(history.entries.filter { $0.year < (collapsed.first ?? 0) })
                        HStack {
                            Button("すべての年を開く") { showPast = true; openGroups = Set(history.groups.map(\.from)) }
                            Spacer()
                            Button("過去を折りたたむ") { showPast = false; openGroups.removeAll() }
                        }.font(.caption).frame(minHeight: 44)
                        DisclosureGroup(isExpanded: $showPast) {
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(history.groups.filter { !$0.years.filter { hidden.contains($0) }.isEmpty }, id: \.from) { group in
                                    DisclosureGroup(isExpanded: Binding(get: { openGroups.contains(group.from) }, set: { if $0 { openGroups.insert(group.from) } else { openGroups.remove(group.from) } })) {
                                        entries(history.entries.filter { group.years.contains($0.year) && hidden.contains($0.year) })
                                    } label: { Text("\(String(group.years.first(where: { hidden.contains($0) }) ?? group.from))〜\(String(group.to))年").font(.subheadline) }
                                }
                            }.padding(.top, 12)
                        } label: { Text("過去の鑑定を見る（\(collapsed.count)年分）").font(.subheadline) }
                        .tint(FateTheme.ink)
                        entries(history.entries.filter { $0.year > (collapsed.last ?? 0) })
                    }
                }
            }
            if loading { FateInlineLoading(title: "時系列を確認しています") }
            if let error {
                Text(error).font(.footnote).foregroundStyle(FateTheme.danger)
                if history == nil {
                    Button("もう一度確認") { Task { await load() } }.buttonStyle(FLSecondaryButtonStyle())
                    if !cards.isEmpty {
                        Text("保存済みの節目").font(.subheadline)
                        ReadingCardList(cards: cards, onQuestion: onQuestion)
                    }
                }
            }
        }.task(id: conversationID) { await load() }
    }
    @ViewBuilder private func entries(_ values: [CoupleAllYearsHistory.Entry]) -> some View {
        ForEach(values, id: \.year) { entry in
            if let label = entry.label { Text(label).font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted) }
            if let card = entry.card {
                ReadingCardList(cards: [card], onQuestion: onQuestion)
            } else {
                Text("\(String(entry.year))年：この年の鑑定を表示できませんでした。")
                    .font(.callout).foregroundStyle(FateTheme.muted).padding(.vertical, 12)
            }
        }
    }
    private func receive(_ value: CoupleAllYearsHistory) {
        history = value; meetingYear = value.meetingYear.map(String.init) ?? ""
        showPast = false; openGroups.removeAll()
    }
    private func load() async {
        if history != nil && loadedConversationID == conversationID { return }
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--timeline-tags91-preview"),
           let value = try? JSONDecoder().decode(CoupleAllYearsHistory.self, from: TimelinePreview91.coupleData) {
            receive(value); return
        }
        if ProcessInfo.processInfo.arguments.contains("--couple-timeline-preview"),
           let url = Bundle.main.url(forResource: "couple-preview", withExtension: "json"),
           let bytes = try? Data(contentsOf: url),
           let value = try? JSONDecoder().decode(CoupleAllYearsHistory.self, from: bytes) {
            receive(value); return
        }
#endif
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--couple-timeline-preview") {
            let entries = (2010...2035).map { year in
                CoupleAllYearsHistory.Entry(year: year, label: year == 2010 ? "出会った年" : nil, contentStatus: "ready", card: ReadingCard(id: "preview-\(year)", kind: "timing", tab: "timing", scope: "couple", title: "小さな約束を重ね、ふたりの時間を整える年", summary: "表示確認用の架空原稿です。", tags: ["時期"], period: ReadingCardPeriod(label: "\(year)年"), pages: [ReadingCardPage(role: "core", label: "ふたりの流れ", text: "これは表示確認用のサンプルです。お互いのペースを確かめながら、日々の予定や約束を整えていきます。", note: nil)], sections: nil, evidence: []))
            }
            receive(CoupleAllYearsHistory(status: "ready", meetingYear: 2010, referenceYear: 2026, endYear: 2035, minMeetingYear: 1990, collapsedYears: Array(2011...2020), groups: [.init(from: 2011, to: 2015, years: Array(2011...2015)), .init(from: 2016, to: 2020, years: Array(2016...2020))], entries: entries)); return
        }
#endif
        guard let conversationID else { error = "保存済みの鑑定書から開いてください。"; return }
        let owner = AccountScope(auth)
        history = nil; loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.coupleAllYears(id: conversationID, auth: auth)
            try owner.check(auth); guard !Task.isCancelled else { return }
            loadedConversationID = conversationID
            receive(value)
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "時系列を取得できませんでした。時間をおいて再試行してください。"
        }
    }
    private func save() async {
        guard let conversationID, let history, !loading else { return }
        let raw = meetingYear.trimmingCharacters(in: .whitespacesAndNewlines)
        let year = Int(raw)
        if !raw.isEmpty && (raw.range(of: #"^[0-9]{4}$"#, options: .regularExpression) == nil || year == nil || year! < history.minMeetingYear || year! > history.referenceYear) {
            error = "出会った年は、ふたりが生まれた年以降から今年までの西暦4桁で入力してください。"; return
        }
        let owner = AccountScope(auth)
        loading = true; error = nil
        defer { loading = false }
        do {
            let value = try await APIClient.shared.saveCoupleMeetingYear(id: conversationID, meetingYear: raw.isEmpty ? nil : year, auth: auth)
            try owner.check(auth); guard !Task.isCancelled else { return }
            loadedConversationID = conversationID
            receive(value)
        } catch {
            guard owner.isCurrent(auth), !Task.isCancelled else { return }
            self.error = "保存結果を確認できませんでした。同じ年でもう一度保存してください。"
        }
    }
}

struct PartnerReadingView: View {
    let conversationID: UUID
    @EnvironmentObject private var auth: AuthStore
    @State private var report: GeneratedReport?
    @State private var error: String?
    @State private var loadedOwner: AccountScope?
    var body: some View {
        Group {
            if let report {
                PartnerEssenceContent(report: report)
            } else if let error {
                FLErrorState(title: "あの人の鑑定を読み込めませんでした", message: error) { Task { await load() } }
            } else { FateInlineLoading(title: "あの人の鑑定を開いています") }
        }.task(id: AccountScope(auth)) {
            if loadedOwner != AccountScope(auth) { report = nil; await load() }
        }
    }
    private func load() async {
        let owner = AccountScope(auth)
        do {
            let result = try await APIClient.shared.partnerReading(id: conversationID, auth: auth)
            try owner.check(auth)
            report = GeneratedReport(birthData: [:], calculatedData: [:], text: result.reportText, cards: result.cards, chartSections: result.chartSections ?? [])
            loadedOwner = owner; error = nil
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

/// The outer relationship hub already owns the banner and tabs.
struct PartnerEssenceContent: View {
    let report: GeneratedReport
    var body: some View {
        ReadingCardList(cards: report.cards.filter { $0.resolvedTab == "essence" && $0.scope == "self" }, onQuestion: { _ in })
            .environment(\.isPartnerReading, true)
    }
}

private struct PartnerReadingEnvironmentKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var isPartnerReading: Bool {
        get { self[PartnerReadingEnvironmentKey.self] }
        set { self[PartnerReadingEnvironmentKey.self] = newValue }
    }
}
