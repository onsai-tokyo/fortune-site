import SwiftUI

enum FateTheme {
    static let canvas = Color(red: 1, green: 1, blue: 1)
    static let ink = Color(red: 0.067, green: 0.067, blue: 0.067)
    static let body = Color(red: 0.176, green: 0.176, blue: 0.176)
    static let muted = Color(red: 0.463, green: 0.463, blue: 0.463)
    static let line = Color(red: 0.910, green: 0.910, blue: 0.910)
    static let surface = Color(red: 0.969, green: 0.969, blue: 0.969)
    static let danger = Color(red: 0.706, green: 0.137, blue: 0.094)
}

enum FateType {
    static let screenTitle = Font.system(size: 30, weight: .bold)
    static let sectionTitle = Font.system(size: 22, weight: .medium)
    static let cardTitle = Font.system(size: 17, weight: .semibold)
    static let body = Font.system(size: 15)
    static let caption = Font.system(size: 13)
    static let label = Font.system(size: 12, weight: .medium)
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
enum FLRadius { static let card: CGFloat = 16; static let button: CGFloat = 16; static let chip: CGFloat = 18 }

struct FateMark: View {
    let size: CGFloat
    var body: some View { ZStack {
        Ellipse().stroke(FateTheme.ink, lineWidth: 1).frame(width: size, height: size * 0.58)
        Ellipse().stroke(FateTheme.ink, lineWidth: 1).frame(width: size * 0.58, height: size).rotationEffect(.degrees(24))
        Rectangle().fill(FateTheme.ink).frame(width: 1, height: size * 0.92)
        Circle().fill(FateTheme.ink).frame(width: max(3, size * 0.07), height: max(3, size * 0.07)).offset(x: size * 0.31, y: -size * 0.12)
    }.frame(width: size, height: size) }
}

struct FLPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label.font(.system(size: 16, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 56).foregroundStyle(FateTheme.canvas).background(FateTheme.ink).clipShape(RoundedRectangle(cornerRadius: 16)).opacity(configuration.isPressed ? 0.72 : 1) }
}
struct FLSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label.font(.system(size: 16, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 56).foregroundStyle(FateTheme.ink).background(FateTheme.canvas).overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line)).clipShape(RoundedRectangle(cornerRadius: 16)).opacity(configuration.isPressed ? 0.65 : 1) }
}
struct FLTextLink: View { let title: String; let action: () -> Void; var body: some View { Button(title, action: action).font(.system(size: 16, weight: .semibold)).foregroundStyle(FateTheme.ink).frame(minHeight: 44) } }
struct FLDivider: View { var body: some View { Rectangle().fill(FateTheme.line).frame(height: 1) } }
struct FLProgressIndicator: View { let current: Int; let total: Int; var body: some View { HStack(spacing: 5) { ForEach(1...total, id: \.self) { step in Capsule().fill(step <= current ? FateTheme.ink : FateTheme.line).frame(height: 3) } } } }
struct FLChip: View { let title: String; var selected = false; let action: () -> Void; var body: some View { Button(title, action: action).font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.ink).padding(.horizontal, 14).frame(height: 36).background(selected ? FateTheme.surface : FateTheme.canvas).overlay(Capsule().stroke(FateTheme.line)).clipShape(Capsule()) } }
struct FLCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content.padding(FateSpacing.cardPadding).frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.canvas)
            .overlay(RoundedRectangle(cornerRadius: FLRadius.card).stroke(FateTheme.line))
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
                if let subtitle { Text(subtitle).font(FateType.caption).foregroundStyle(FateTheme.muted).lineLimit(2) }
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
            Text(title).font(FateType.sectionTitle)
            Text(message).font(FateType.caption).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).lineSpacing(4)
        }.frame(maxWidth: .infinity).padding(.vertical, FateSpacing.sectionV)
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

struct ReadingGenerationProgressView: View {
    let kind: GenerationKind; let progress: GenerationProgress
    var body: some View { VStack(spacing: 28) { Spacer(); FateMark(size: 76); Text(kind == .selfReading ? "あなたのパターンを読んでいます" : "ふたりのパターンを読んでいます").font(.system(size: 21, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.85); Text("\(progress.percent)%").font(.system(size: 44, weight: .bold)); ProgressView(value: Double(progress.percent), total: 100).tint(FateTheme.ink); VStack(spacing: 10) { Text(progress.title).font(.system(size: 20, weight: .semibold)); Text(progress.detail).font(.system(size: 15)).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center) }; Spacer() }.padding(.horizontal, 24).padding(.vertical, 28).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas.ignoresSafeArea()).accessibilityLabel("\(progress.percent)パーセント。\(progress.title)") }
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

struct DateMenuPicker: View {
    @Binding var date: Date
    private let calendar = Calendar(identifier: .gregorian)
    private var components: DateComponents { calendar.dateComponents([.year, .month, .day], from: date) }
    private var year: Binding<Int> { componentBinding(.year, fallback: 1990) }
    private var month: Binding<Int> { componentBinding(.month, fallback: 1) }
    private var day: Binding<Int> { componentBinding(.day, fallback: 1) }
    private var daysInMonth: Int { let first = calendar.date(from: DateComponents(year: year.wrappedValue, month: month.wrappedValue, day: 1)) ?? date; return calendar.range(of: .day, in: .month, for: first)?.count ?? 31 }

    var body: some View {
        HStack(spacing: 8) {
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

    var body: some View {
        HStack(spacing: 8) {
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
            Text("生年月日").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            DateMenuPicker(date: $date)
            FLDivider()
            Text("出生時刻（任意）").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            TimeMenuPicker(time: $birthTime)
            Text("分からない場合は空欄のまま進めます").font(.footnote).foregroundStyle(FateTheme.muted)
            FLDivider()
            Text("出生地").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            selectionRow(value: birthplace) { showBirthplacePicker = true }
            FLDivider()
            Text("性別").font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.muted)
            selectionRow(value: gender == "male" ? "男性" : "女性") { showGenderPicker = true }
        }
        .sheet(isPresented: $showBirthplacePicker) { birthplacePickerSheet }
        .sheet(isPresented: $showGenderPicker) { genderPickerSheet }
    }

    private func selectionRow(value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(value).foregroundStyle(FateTheme.ink); Spacer(); Image(systemName: "chevron.right").foregroundStyle(FateTheme.muted) }
                .contentShape(Rectangle()).padding(.vertical, 6)
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
