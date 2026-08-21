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
typealias PrimaryButtonStyle = FLPrimaryButtonStyle

struct FLTextLink: View { let title: String; let action: () -> Void; var body: some View { Button(title, action: action).font(.system(size: 16, weight: .semibold)).foregroundStyle(FateTheme.ink).frame(minHeight: 44) } }
struct FLDivider: View { var body: some View { Rectangle().fill(FateTheme.line).frame(height: 1) } }
struct FLProgressIndicator: View { let current: Int; let total: Int; var body: some View { HStack(spacing: 5) { ForEach(1...total, id: \.self) { step in Capsule().fill(step <= current ? FateTheme.ink : FateTheme.line).frame(height: 3) } } } }
struct FLChip: View { let title: String; var selected = false; let action: () -> Void; var body: some View { Button(title, action: action).font(.system(size: 13, weight: .medium)).foregroundStyle(FateTheme.ink).padding(.horizontal, 14).frame(height: 36).background(selected ? FateTheme.surface : FateTheme.canvas).overlay(Capsule().stroke(FateTheme.line)).clipShape(Capsule()) } }
struct FLInsightRow: View { let title: String; let subtitle: String; var body: some View { VStack(spacing: 0) { HStack(spacing: 16) { Text(title).font(.system(size: 16, weight: .semibold)).frame(width: 52, alignment: .leading); Text(subtitle).font(.system(size: 14)).foregroundStyle(FateTheme.muted).lineLimit(1); Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(FateTheme.muted) }.frame(minHeight: 64); FLDivider() } } }

struct ReportCard<Content: View>: View { @ViewBuilder let content: Content; var body: some View { content.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FateTheme.canvas).overlay(RoundedRectangle(cornerRadius: 16).stroke(FateTheme.line)) } }
func userFacingErrorMessage(_ error: Error) -> String? { if error is CancellationError { return nil }; if let urlError = error as? URLError, urlError.code == .cancelled { return nil }; return error.localizedDescription }
extension View { func userFacingMessage(_ error: Error) -> String? { userFacingErrorMessage(error) }; func fateScreenTitle(_ title: String) -> some View { toolbar { ToolbarItem(placement: .principal) { Text(title).font(.system(size: 17, weight: .semibold)).lineLimit(1) } }.navigationBarTitleDisplayMode(.inline).toolbarBackground(FateTheme.canvas, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar) } }

struct DateMenuPicker: View { @Binding var date: Date; var body: some View { DatePicker("生年月日", selection: $date, in: Calendar.current.date(from: DateComponents(year: 1900, month: 1, day: 1))!...Date(), displayedComponents: .date).labelsHidden().environment(\.locale, Locale(identifier: "ja_JP")) } }
