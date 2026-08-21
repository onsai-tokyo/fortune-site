import SwiftUI

enum FateTheme {
    static let background = Color(red: 0.965, green: 0.949, blue: 0.918)
    static let primaryText = Color(red: 0.090, green: 0.082, blue: 0.071)
    static let secondaryText = Color(red: 0.435, green: 0.416, blue: 0.384)
    static let border = Color(red: 0.851, green: 0.820, blue: 0.773)
    static let accent = Color(red: 0.580, green: 0.451, blue: 0.220)
    static let buttonBackground = primaryText
    static let buttonText = Color(red: 0.973, green: 0.961, blue: 0.937)
    static let ivory = background
    static let paper = Color(red: 0.973, green: 0.961, blue: 0.937)
    static let ink = primaryText
    static let muted = secondaryText
    static let weak = Color(red: 0.478, green: 0.439, blue: 0.396)
    static let gold = accent
    static let line = border
    static let destructive = Color(red: 0.639, green: 0.227, blue: 0.165)
}

enum FLSpacing { static let xs: CGFloat = 8; static let sm: CGFloat = 12; static let md: CGFloat = 16; static let lg: CGFloat = 24; static let xl: CGFloat = 32; static let section: CGFloat = 40 }
enum FLRadius { static let card: CGFloat = 14; static let button: CGFloat = 12; static let chip: CGFloat = 8 }

struct ReportCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FateTheme.paper)
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(FateTheme.line))
            .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

/// SwiftUIの画面遷移に伴うキャンセルはユーザー向けエラーとして表示しない。
func userFacingErrorMessage(_ error: Error) -> String? {
    if error is CancellationError { return nil }
    if let urlError = error as? URLError, urlError.code == .cancelled { return nil }
    return error.localizedDescription
}

extension View {
    func userFacingMessage(_ error: Error) -> String? { userFacingErrorMessage(error) }

    func fateScreenTitle(_ title: String) -> some View {
        toolbar {
            ToolbarItem(placement: .principal) {
                Text(title).font(.system(size: 17, weight: .semibold))
                    .lineLimit(1).truncationMode(.tail)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(FateTheme.ivory, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}

struct OutlineGoldButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .frame(maxWidth: .infinity).padding(.vertical, 15)
            .foregroundStyle(FateTheme.primaryText)
            .background(.clear)
            .overlay(RoundedRectangle(cornerRadius: FLRadius.button).stroke(FateTheme.border))
            .clipShape(RoundedRectangle(cornerRadius: FLRadius.button))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct GoldButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(FateTheme.buttonText)
            .background(FateTheme.buttonBackground.opacity(configuration.isPressed ? 0.75 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

typealias PrimaryButtonStyle = GoldButtonStyle

struct DateMenuPicker: View {
    @Binding var date: Date
    private let calendar = Calendar(identifier: .gregorian)
    private var components: DateComponents { calendar.dateComponents([.year, .month, .day], from: date) }
    private var year: Binding<Int> { componentBinding(.year, fallback: 1990) }
    private var month: Binding<Int> { componentBinding(.month, fallback: 1) }
    private var day: Binding<Int> { componentBinding(.day, fallback: 1) }
    private var daysInMonth: Int {
        let value = calendar.date(from: DateComponents(year: year.wrappedValue, month: month.wrappedValue, day: 1)) ?? date
        return calendar.range(of: .day, in: .month, for: value)?.count ?? 31
    }

    var body: some View {
        HStack(spacing: 10) {
            Picker("年", selection: year) {
                ForEach(Array(stride(from: calendar.component(.year, from: Date()), through: 1900, by: -1)), id: \.self) { Text(verbatim: "\($0)年").tag($0) }
            }
            Picker("月", selection: month) { ForEach(1...12, id: \.self) { Text(verbatim: "\($0)月").tag($0) } }
            Picker("日", selection: day) { ForEach(1...daysInMonth, id: \.self) { Text(verbatim: "\($0)日").tag($0) } }
        }
        .pickerStyle(.menu)
        .tint(FateTheme.primaryText)
    }

    private func componentBinding(_ component: Calendar.Component, fallback: Int) -> Binding<Int> {
        Binding(get: { components.value(for: component) ?? fallback }, set: { newValue in
            var updated = components
            updated.setValue(newValue, for: component)
            let maxDay = calendar.range(of: .day, in: .month, for: calendar.date(from: DateComponents(year: updated.year, month: updated.month, day: 1)) ?? date)?.count ?? 31
            updated.day = min(updated.day ?? 1, maxDay)
            if let value = calendar.date(from: updated) { date = value }
        })
    }
}
