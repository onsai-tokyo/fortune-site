import SwiftUI

enum LegalDocument: String, Identifiable {
    case terms, privacy
    var id: String { rawValue }
    var title: String { self == .terms ? "利用規約" : "プライバシーポリシー" }
    static func matching(_ url: URL) -> Self? {
        guard url.host == AppConfig.websiteBaseURL.host else { return nil }
        return Self(rawValue: url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }
}

struct LegalSection: Decodable, Identifiable {
    let id: String
    let title: String
    let paragraphs: [String]
}

struct LegalDocumentView: View {
    let document: LegalDocument
    var anchor: String? = nil
    @Environment(\.dismiss) private var dismiss
    private var sections: [LegalSection] {
        guard let url = Bundle.main.url(forResource: document.rawValue, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let value = try? JSONDecoder().decode([LegalSection].self, from: data) else { return [] }
        return value
    }
    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        ForEach(sections) { section in
                            VStack(alignment: .leading, spacing: 12) {
                                if !section.title.isEmpty { Text(section.title).font(.headline) }
                                ForEach(Array(section.paragraphs.enumerated()), id: \.offset) { _, text in
                                    Text(text).font(.subheadline).lineSpacing(7).textSelection(.enabled)
                                }
                            }.frame(maxWidth: .infinity, alignment: .leading).id(section.id)
                        }
                        if document == .terms {
                            LegalLink("プライバシーポリシー", destination: AppConfig.websiteBaseURL.appendingPathComponent("privacy"))
                        }
                    }.padding(24)
                }.onAppear { if let anchor { proxy.scrollTo(anchor, anchor: .top) } }
            }
            .background(FateTheme.canvas).foregroundStyle(FateTheme.ink)
            .navigationTitle(document.title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } } }
        }.tint(FateTheme.ink)
    }
}

private struct InAppLegalLinks: ViewModifier {
    @State private var document: LegalDocument?
    @State private var anchor: String?
    func body(content: Content) -> some View {
        content.environment(\.openURL, OpenURLAction { url in
            guard let value = LegalDocument.matching(url) else { return .systemAction }
            anchor = url.fragment; document = value
            return .handled
        }).sheet(item: $document) { LegalDocumentView(document: $0, anchor: anchor) }
    }
}
extension View {
    func inAppLegalLinks() -> some View { modifier(InAppLegalLinks()) }
}
struct LegalLink: View {
    let title: String
    let destination: URL
    init(_ title: String, destination: URL) { self.title = title; self.destination = destination }
    var body: some View { Link(title, destination: destination).inAppLegalLinks() }
}
