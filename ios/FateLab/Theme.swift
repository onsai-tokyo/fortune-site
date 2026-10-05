import SwiftUI

enum FateTheme {
    static let canvas = Color(red: 0.977, green: 0.973, blue: 0.961)
    static let ink = Color(red: 0.078, green: 0.086, blue: 0.078)
    static let body = Color(red: 0.239, green: 0.247, blue: 0.227)
    static let muted = Color(red: 0.424, green: 0.439, blue: 0.408)
    static let line = Color(red: 0.887, green: 0.884, blue: 0.862)
    static let surface = Color(red: 0.936, green: 0.932, blue: 0.916)
    static let card = Color.white
    static let cream = Color(red: 0.963, green: 0.944, blue: 0.893)
    static let danger = Color(red: 0.706, green: 0.137, blue: 0.094)
}

enum FateType {
    static let screenTitle = Font.system(.title, design: .default, weight: .medium)
    static let sectionTitle = Font.system(.title3, design: .default, weight: .medium)
    static let cardTitle = Font.system(.body, weight: .medium)
    static let body = Font.system(.subheadline)
    static let caption = Font.system(.footnote)
    static let label = Font.system(.caption, weight: .medium)
    static let button = Font.system(.callout, weight: .medium)
}

enum FateSpacing {
    static let screenH: CGFloat = 20
    static let sectionV: CGFloat = 28
    static let cardPadding: CGFloat = 18
    static let rowV: CGFloat = 16
    static let compact: CGFloat = 8
    static let regular: CGFloat = 12
}

enum FLSpacing { static let xs: CGFloat = 8; static let sm: CGFloat = 12; static let md: CGFloat = 16; static let lg: CGFloat = 24; static let xl: CGFloat = 32; static let section: CGFloat = 40 }
enum FLRadius { static let card: CGFloat = 20; static let button: CGFloat = 16; static let chip: CGFloat = 18 }

struct FateMark: View {
    let size: CGFloat
    var color: Color = FateTheme.ink
    var body: some View { ZStack {
        Ellipse().stroke(color, lineWidth: 1).frame(width: size, height: size * 0.58)
        Ellipse().stroke(color, lineWidth: 1).frame(width: size * 0.58, height: size).rotationEffect(.degrees(24))
        Rectangle().fill(color).frame(width: 1, height: size * 0.92)
        Circle().fill(color).frame(width: max(3, size * 0.07), height: max(3, size * 0.07)).offset(x: size * 0.31, y: -size * 0.12)
    }.frame(width: size, height: size) }
}

struct FLPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(FateType.button)
            .multilineTextAlignment(.center).padding(.horizontal, 20).padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(FateTheme.canvas).background(FateTheme.ink, in: RoundedRectangle(cornerRadius: FLRadius.button, style: .continuous))
            .opacity(!isEnabled ? 0.4 : configuration.isPressed ? 0.72 : 1)
    }
}
struct FLSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(FateType.button)
            .multilineTextAlignment(.center).padding(.horizontal, 16).padding(.vertical, 13)
            .frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(FateTheme.ink).background(FateTheme.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line, lineWidth: 0.7))
            .opacity(!isEnabled ? 0.4 : configuration.isPressed ? 0.65 : 1)
    }
}
struct FLTextLink: View { let title: String; let action: () -> Void; var body: some View { Button(title, action: action).font(.system(.subheadline, weight: .medium)).foregroundStyle(FateTheme.ink).frame(minHeight: 44) } }
struct FLDivider: View { var body: some View { Rectangle().fill(FateTheme.line).frame(height: 0.5) } }
struct FLProgressIndicator: View { let current: Int; let total: Int; var body: some View { HStack(spacing: 5) { ForEach(1...total, id: \.self) { step in Capsule().fill(step <= current ? FateTheme.ink : FateTheme.line).frame(height: 3) } } } }
struct FLChip: View { let title: String; var selected = false; let action: () -> Void; var body: some View { Button(title, action: action).font(.caption.weight(.medium)).foregroundStyle(FateTheme.ink).padding(.horizontal, 14).frame(minHeight: 44).background(selected ? FateTheme.surface : FateTheme.canvas).overlay(Capsule().stroke(FateTheme.line)).clipShape(Capsule()) } }
struct FLCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content.padding(FateSpacing.cardPadding).frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.card, in: RoundedRectangle(cornerRadius: FLRadius.card))
            .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(FateTheme.line, lineWidth: 0.7))
    }
}

struct FLListRow: View {
    let title: String
    var subtitle: String? = nil
    var showsChevron = true
    var body: some View {
        HStack(spacing: FateSpacing.regular) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(FateType.cardTitle).foregroundStyle(FateTheme.ink)
                if let subtitle { Text(subtitle).font(FateType.caption).foregroundStyle(FateTheme.muted).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 8)
            if showsChevron { Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }
        }
        .padding(.vertical, FateSpacing.rowV)
        .overlay(FLDivider(), alignment: .bottom)
    }
}

struct FLSectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(FateType.sectionTitle).foregroundStyle(FateTheme.ink)
            if let subtitle { Text(subtitle).font(FateType.caption).foregroundStyle(FateTheme.muted).lineSpacing(4) }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FLEmptyState: View {
    let title: String
    let message: String
    var body: some View {
        VStack(spacing: FateSpacing.regular) {
            FateMark(size: 32).padding(18).background(FateTheme.cream.opacity(0.55), in: Circle()).accessibilityHidden(true)
            Text(title).font(FateType.sectionTitle).multilineTextAlignment(.center)
            Text(message).font(FateType.caption).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).lineSpacing(4)
        }.frame(maxWidth: .infinity).padding(24).background(FateTheme.card.opacity(0.75), in: RoundedRectangle(cornerRadius: 22))
    }
}

struct FLErrorState: View {
    enum Kind { case network, dataFetch, system }
    let kind: Kind
    let customTitle: String?
    let customMessage: String?
    let onRetry: () -> Void
    let onBack: (() -> Void)?

    init(kind: Kind, onRetry: @escaping () -> Void, onBack: (() -> Void)? = nil) {
        self.kind = kind; customTitle = nil; customMessage = nil
        self.onRetry = onRetry; self.onBack = onBack
    }

    init(title: String, message: String, retry: @escaping () -> Void) {
        kind = .dataFetch; customTitle = title; customMessage = message
        onRetry = retry; onBack = nil
    }

    private var title: String {
        if let customTitle { return customTitle }
        return switch kind {
        case .network: "通信エラーが発生しました"
        case .dataFetch: "データの取得に失敗しました"
        case .system: "予期しないエラーが発生しました"
        }
    }
    private var message: String {
        if let customMessage { return customMessage }
        return switch kind {
        case .network: "インターネット接続を確認して、もう一度お試しください。"
        case .dataFetch: "しばらく時間をおいてから、もう一度お試しください。"
        case .system: "ご不便をおかけして申し訳ありません。"
        }
    }
    var body: some View {
        FLCard {
            VStack(alignment: .leading, spacing: FateSpacing.regular) {
                Text(title).font(FateType.cardTitle)
                Text(message).font(FateType.caption).foregroundStyle(FateTheme.muted).lineSpacing(4)
                Button("再試行", action: onRetry).buttonStyle(FLSecondaryButtonStyle())
                if let onBack { Button("戻る", action: onBack).foregroundStyle(FateTheme.ink) }
                else if kind == .system { Link("お問い合わせ", destination: AppConfig.websiteBaseURL.appending(path: "/contact")).foregroundStyle(FateTheme.ink) }
            }
        }
    }
}

struct FLInsightRow: View { let title: String; let subtitle: String; var body: some View { FLListRow(title: title, subtitle: subtitle) } }

/// Shared loading presentation; the displayed progress always comes from the operation.
struct FateLoadingView: View {
    let title: String
    let detail: String
    var progress: Int? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(FateTheme.card.opacity(0.75)).frame(width: 104, height: 104)
                    .scaleEffect(breathing && !reduceMotion ? 1.06 : 1)
                Circle().stroke(FateTheme.line.opacity(0.7), lineWidth: 0.5).frame(width: 122, height: 122)
                FateMark(size: 54).opacity(0.75)
            }.accessibilityHidden(true)
            Text("FATE LAB").font(.system(size: 10, weight: .medium)).tracking(4)
                .foregroundStyle(FateTheme.muted).padding(.top, 24)
            Text(title).font(.system(.title3, weight: .medium)).lineSpacing(5)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).padding(.top, 28)
            Text(detail).font(FateType.caption).foregroundStyle(FateTheme.muted).lineSpacing(5)
                .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).padding(.top, 12)
            Group {
                if let progress {
                    VStack(spacing: 10) {
                        ProgressView(value: Double(min(100, max(0, progress))), total: 100)
                            .tint(FateTheme.muted).accessibilityLabel("鑑定の進み具合")
                        Text("\(min(100, max(0, progress)))%").font(.caption.monospacedDigit())
                            .foregroundStyle(FateTheme.muted).accessibilityHidden(true)
                    }
                } else { ProgressView().tint(FateTheme.muted).accessibilityLabel("読み込み中") }
            }.frame(maxWidth: 180).padding(.top, 28)
        }
        .frame(maxWidth: 340).padding(.horizontal, 28).padding(.vertical, 36)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) { breathing = true }
        }
        .onDisappear { breathing = false }
    }
}

struct FateLoadingBackground: View {
    var body: some View {
        FateTheme.canvas.overlay {
            FateArtwork(name: "QuietMountains").opacity(0.28)
                .mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))
        }.ignoresSafeArea().accessibilityHidden(true).allowsHitTesting(false)
    }
}

struct ReadingGenerationProgressView: View {
    let kind: GenerationKind
    let progress: GenerationProgress
    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 12) {
                    Spacer(minLength: 24)
                    FateLoadingView(
                        title: kind == .selfReading ? "あなたのパターンを読み解いています" : "ふたりのパターンを読み解いています",
                        detail: progress.title + "\n" + progress.detail,
                        progress: progress.isIndeterminate ? nil : progress.percent)
                    SlowConnectionNotice().id(progress).padding(.horizontal, 32)
                    Spacer(minLength: 24)
                }.frame(maxWidth: .infinity).frame(minHeight: geometry.size.height)
            }.scrollIndicators(.hidden)
        }.background { FateLoadingBackground() }
    }
}

/// Delayed explanation only: never starts a retry or clears an in-flight operation.
struct SlowConnectionNotice: View {
    @State private var showNotice = false
    var body: some View {
        Group {
            if showNotice {
                Text("接続や処理に時間がかかっています。通信できない場合は、再試行の案内が表示されます。")
                    .font(.footnote).foregroundStyle(FateTheme.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .task {
            do { try await Task.sleep(for: .seconds(8)); showNotice = true }
            catch { /* The stage/view changed; keep the next stage's timer independent. */ }
        }
    }
}

struct ReportCard<Content: View>: View { @ViewBuilder let content: Content; var body: some View { FLCard { content } } }
func userFacingErrorMessage(_ error: Error) -> String? { if error is CancellationError { return nil }; if let urlError = error as? URLError, urlError.code == .cancelled { return nil }; return error.localizedDescription }
func errorStateKind(_ error: Error) -> FLErrorState.Kind {
    if let urlError = error as? URLError {
        let networkCodes: Set<URLError.Code> = [.notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed]
        return networkCodes.contains(urlError.code) ? .network : .dataFetch
    }
    if case APIError.http(let status, _) = error, status >= 500 { return .dataFetch }
    if error is APIError { return .dataFetch }
    return .system
}
extension View { func userFacingMessage(_ error: Error) -> String? { userFacingErrorMessage(error) }; func fateScreenTitle(_ title: String) -> some View { toolbar { ToolbarItem(placement: .principal) { Text(title).font(.system(size: 17, weight: .semibold)).lineLimit(1) } }.navigationBarTitleDisplayMode(.inline).toolbarBackground(FateTheme.canvas, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar) } }

/// Fixed brand header shared by the five tab roots.
struct FateAppHeader: View {
    var body: some View {
        HStack(spacing: 8) {
            Spacer()
            FateMark(size: 24)
            Text("FATE LAB").font(.system(size: 12, weight: .medium)).tracking(3)
            Spacer()
        }
        .padding(.horizontal, FateSpacing.screenH)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(FateTheme.canvas)
        .overlay(Rectangle().frame(height: 0.5).foregroundStyle(FateTheme.line), alignment: .bottom)
    }
}

extension View {
    func fateAppHeader() -> some View {
        toolbar(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) { FateAppHeader() }
    }
}

struct DateMenuPicker: View {
    @Binding var date: Date
    private let calendar = Calendar(identifier: .gregorian)
    private var components: DateComponents { calendar.dateComponents([.year, .month, .day], from: date) }
    private var year: Binding<Int> { componentBinding(.year, fallback: 1990) }
    private var month: Binding<Int> { componentBinding(.month, fallback: 1) }
    private var day: Binding<Int> { componentBinding(.day, fallback: 1) }
    private var daysInMonth: Int { let first = calendar.date(from: DateComponents(year: year.wrappedValue, month: month.wrappedValue, day: 1)) ?? date; return calendar.range(of: .day, in: .month, for: first)?.count ?? 31 }

    @Environment(\.dynamicTypeSize) private var textSize
    var body: some View {
        let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
            Picker("年", selection: year) { ForEach(Array(stride(from: calendar.component(.year, from: Date()), through: 1900, by: -1)), id: \.self) { Text(verbatim: "\($0)年").tag($0) } }
            Picker("月", selection: month) { ForEach(1...12, id: \.self) { Text(verbatim: "\($0)月").tag($0) } }
            Picker("日", selection: day) { ForEach(1...daysInMonth, id: \.self) { Text(verbatim: "\($0)日").tag($0) } }
        }.pickerStyle(.menu).tint(FateTheme.ink)
    }

    private func componentBinding(_ component: Calendar.Component, fallback: Int) -> Binding<Int> {
        Binding(get: { components.value(for: component) ?? fallback }, set: { value in
            var updated = components; updated.setValue(value, for: component)
            let first = calendar.date(from: DateComponents(year: updated.year, month: updated.month, day: 1)) ?? date
            updated.day = min(updated.day ?? 1, calendar.range(of: .day, in: .month, for: first)?.count ?? 31)
            if let next = calendar.date(from: updated), next <= Date() { date = next }
        })
    }
}

struct TimeMenuPicker: View {
    @Binding var time: Date?
    private var hour: Binding<Int?> { Binding(get: { time.map { Calendar.current.component(.hour, from: $0) } }, set: { value in
        guard let value else { time = nil; return }
        update(hour: value, minute: minute.wrappedValue ?? 0)
    }) }
    private var minute: Binding<Int?> { Binding(get: {
        time.map { Calendar.current.component(.minute, from: $0) }
    }, set: { value in
        guard let value else { time = nil; return }
        update(hour: hour.wrappedValue ?? 12, minute: value)
    }) }

    @Environment(\.dynamicTypeSize) private var textSize
    var body: some View {
        let layout = textSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
            Picker("時", selection: hour) {
                Text("--時").tag(Int?.none)
                ForEach(0..<24, id: \.self) { Text(verbatim: "\($0)時").tag(Int?.some($0)) }
            }
            Picker("分", selection: minute) {
                Text("--分").tag(Int?.none)
                ForEach(0..<60, id: \.self) { Text(verbatim: "\($0)分").tag(Int?.some($0)) }
            }.disabled(time == nil)
            Spacer()
        }
        .pickerStyle(.menu).tint(FateTheme.ink)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(time == nil ? "出生時刻は空欄" : "出生時刻")
    }

    private func update(hour: Int, minute: Int) {
        time = Calendar.current.date(from: DateComponents(year: 2000, month: 1, day: 1, hour: hour, minute: minute))
    }
}

struct BirthProfileFields: View {
    @Binding var date: Date
    @Binding var birthTime: Date?
    @Binding var birthplace: String
    @Binding var gender: String
    @State private var showBirthplacePicker = false
    @State private var showGenderPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("生年月日").font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
            DateMenuPicker(date: $date)
            FLDivider()
            Text("出生時刻（任意）").font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
            Text("出生時刻が分かると、時刻に応じた命式も含めて、より詳しく鑑定できます。")
                .font(.footnote).foregroundStyle(FateTheme.muted).fixedSize(horizontal: false, vertical: true)
            Text("母子健康手帳の出産の記録に載っています。時刻があると、時期を月単位で読めます。").font(.caption).foregroundStyle(FateTheme.muted)
            TimeMenuPicker(time: $birthTime)
            Text("分からない場合は空欄のまま進めます").font(.footnote).foregroundStyle(FateTheme.muted)
            FLDivider()
            Text("出生地").font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
            selectionRow(value: birthplace) { showBirthplacePicker = true }
            FLDivider()
            Text("性別").font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
            selectionRow(value: gender == "male" ? "男性" : "女性") { showGenderPicker = true }
        }
        .sheet(isPresented: $showBirthplacePicker) { birthplacePickerSheet }
        .sheet(isPresented: $showGenderPicker) { genderPickerSheet }
    }

    private func selectionRow(value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(value).foregroundStyle(FateTheme.ink); Spacer(); Image(systemName: "chevron.right").foregroundStyle(FateTheme.muted) }
                .frame(minHeight: 44).contentShape(Rectangle())
        }.buttonStyle(.plain)
    }

    private var birthplacePickerSheet: some View {
        NavigationStack {
            List(OnboardingView.prefectures, id: \.self) { place in
                Button { birthplace = place; showBirthplacePicker = false } label: {
                    HStack { Text(place); Spacer(); if birthplace == place { Image(systemName: "checkmark") } }
                }.foregroundStyle(FateTheme.ink)
            }.scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("出生地")
        }.presentationDetents([.large])
    }

    private var genderPickerSheet: some View {
        NavigationStack {
            List {
                Button("女性") { gender = "female"; showGenderPicker = false }
                Button("男性") { gender = "male"; showGenderPicker = false }
            }.foregroundStyle(FateTheme.ink).scrollContentBackground(.hidden).background(FateTheme.canvas).fateScreenTitle("性別")
        }.presentationDetents([.medium])
    }
}

/// Bundled decorative art never performs a request or participates in layout sizing.
struct FateArtwork: View {
    let name: String
    var alignment: Alignment = .center

    var body: some View {
        GeometryReader { geometry in
            Image(name).resizable().scaledToFill()
                .frame(width: geometry.size.width, height: geometry.size.height, alignment: alignment)
                .clipped()
        }
        .allowsHitTesting(false).accessibilityHidden(true)
    }
}

struct FateEditorialHero: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(eyebrow).font(.caption2.weight(.medium)).tracking(2.5).foregroundStyle(FateTheme.muted)
            Text(title).font(FateType.screenTitle).lineSpacing(5).foregroundStyle(FateTheme.ink)
            Text(subtitle).font(.subheadline).lineSpacing(5).foregroundStyle(FateTheme.muted)
        }.padding(24).padding(.bottom, 44).frame(maxWidth: .infinity, alignment: .leading)
            .background {
                FateArtwork(name: "QuietMountains")
                    .overlay(LinearGradient(colors: [FateTheme.cream.opacity(0.97), FateTheme.cream.opacity(0.72), .clear], startPoint: .top, endPoint: .bottom))
            }.clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

/// A single field surface shared by sign-in and profile forms.
extension View {
    func fateInput() -> some View {
        font(.body).padding(.horizontal, 16).padding(.vertical, 15)
            .frame(minHeight: 52)
            .background(FateTheme.card, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line, lineWidth: 0.7))
    }
}

struct FateInlineLoading: View {
    let title: String
    var body: some View {
        HStack(spacing: 12) {
            ProgressView().tint(FateTheme.muted)
            Text(title).font(.footnote).foregroundStyle(FateTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.surface.opacity(0.6), in: RoundedRectangle(cornerRadius: 16))
            .accessibilityElement(children: .combine)
    }
}
