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
struct FLInsightRow: View { let title: String; let subtitle: String; var body: some View { VStack(spacing: 0) { HStack(spacing: 16) { Text(title).font(.system(size: 16, weight: .semibold)).frame(width: 52, alignment: .leading); Text(subtitle).font(.system(size: 14)).foregroundStyle(FateTheme.muted).lineLimit(1); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }.frame(minHeight: 64); FLDivider() } } }

struct ReadingGenerationProgressView: View {
    let kind: GenerationKind; let progress: GenerationProgress
    var body: some View { VStack(spacing: 28) { Spacer(); FateMark(size: 76); Text(kind == .selfReading ? "あなたのパターンを読んでいます" : "ふたりのパターンを読んでいます").font(.system(size: 21, weight: .semibold)); Text("\(progress.percent)%").font(.system(size: 44, weight: .bold)); ProgressView(value: Double(progress.percent), total: 100).tint(FateTheme.ink); VStack(spacing: 10) { Text(progress.title).font(.system(size: 20, weight: .semibold)); Text(progress.detail).font(.system(size: 15)).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center) }; Spacer() }.padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(FateTheme.canvas.ignoresSafeArea()).accessibilityLabel("\(progress.percent)パーセント。\(progress.title)") }
}

struct ReportCard<Content: View>: View { @ViewBuilder let content: Content; var body: some View { content.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.canvas).overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line)) } }
func userFacingErrorMessage(_ error: Error) -> String? { if error is CancellationError { return nil }; if let urlError = error as? URLError, urlError.code == .cancelled { return nil }; return error.localizedDescription }
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
        update(hour: value, minute: minuteValue)
    }) }
    private var minuteValue: Int { time.map { Calendar.current.component(.minute, from: $0) } ?? 0 }
    private var minute: Binding<Int> { Binding(get: { minuteValue }, set: { update(hour: hour.wrappedValue ?? 12, minute: $0) }) }

    var body: some View {
        HStack(spacing: 8) {
            Picker("時", selection: hour) {
                Text("未入力").tag(Int?.none)
                ForEach(0..<24, id: \.self) { Text(verbatim: "\($0)時").tag(Int?.some($0)) }
            }
            Picker("分", selection: minute) { ForEach(0..<60, id: \.self) { Text(verbatim: "\($0)分").tag($0) } }.disabled(time == nil)
            Spacer()
        }.pickerStyle(.menu).tint(FateTheme.ink)
    }

    private func update(hour: Int, minute: Int) {
        time = Calendar.current.date(from: DateComponents(year: 2000, month: 1, day: 1, hour: hour, minute: minute))
    }
}
