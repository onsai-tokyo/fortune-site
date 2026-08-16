import SwiftUI

enum FateTheme {
    static let ivory = Color(red: 0.98, green: 0.969, blue: 0.937)
    static let paper = Color(red: 1.0, green: 0.992, blue: 0.973)
    static let ink = Color(red: 0.129, green: 0.114, blue: 0.094)
    static let muted = Color(red: 0.361, green: 0.325, blue: 0.286)
    static let weak = Color(red: 0.478, green: 0.439, blue: 0.396)
    static let gold = Color(red: 0.604, green: 0.427, blue: 0.086)
    static let line = Color(red: 0.847, green: 0.780, blue: 0.620)
    static let destructive = Color(red: 0.639, green: 0.227, blue: 0.165)
}

enum FLSpacing { static let xs: CGFloat = 8; static let sm: CGFloat = 12; static let md: CGFloat = 16; static let lg: CGFloat = 24; static let xl: CGFloat = 32; static let section: CGFloat = 40 }
enum FLRadius { static let card: CGFloat = 16; static let button: CGFloat = 12; static let chip: CGFloat = 8 }

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

extension View {
    func fateScreenTitle(_ title: String) -> some View {
        toolbar {
            ToolbarItem(placement: .principal) {
                Text(title).font(.system(size: 22, weight: .semibold, design: .serif))
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
            .foregroundStyle(FateTheme.gold)
            .background(FateTheme.paper)
            .overlay(RoundedRectangle(cornerRadius: FLRadius.button).stroke(FateTheme.gold))
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
            .foregroundStyle(.white)
            .background(FateTheme.gold.opacity(configuration.isPressed ? 0.75 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
