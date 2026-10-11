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
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("FATE LAB").font(.caption.weight(.medium)).tracking(3).foregroundStyle(FateTheme.muted)
                            Text(document.title).font(.system(.title2, weight: .medium))
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 8)
                        ForEach(sections) { section in
                            VStack(alignment: .leading, spacing: 18) {
                                if !section.title.isEmpty {
                                    Text(section.title).font(.system(.headline, weight: .semibold))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                ForEach(Array(section.paragraphs.enumerated()), id: \.offset) { _, text in
                                    legalParagraph(text, highlightsLabels: section.id == "ai-consultation")
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(section.id == "ai-consultation" ? 20 : 0)
                            .background {
                                if section.id == "ai-consultation" {
                                    RoundedRectangle(cornerRadius: 18).fill(FateTheme.card)
                                }
                            }
                            .id(section.id)
                            if section.id != sections.last?.id { Divider().overlay(FateTheme.line) }
                        }
                        if document == .terms {
                            LegalLink("プライバシーポリシー", destination: AppConfig.websiteBaseURL.appendingPathComponent("privacy"))
                                .font(.subheadline).padding(.vertical, 12)
                        }
                    }.padding(.horizontal, 24).padding(.vertical, 20)
                }.onAppear { if let anchor { proxy.scrollTo(anchor, anchor: .top) } }
            }
            .background(FateTheme.canvas).foregroundStyle(FateTheme.ink)
            .navigationTitle(document.title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } } }
        }.tint(FateTheme.ink)
    }

    @ViewBuilder private func legalParagraph(_ text: String, highlightsLabels: Bool) -> some View {
        if highlightsLabels, let separator = text.firstIndex(of: "：") {
            VStack(alignment: .leading, spacing: 6) {
                Text(String(text[..<separator])).font(.caption.weight(.semibold)).foregroundStyle(FateTheme.muted)
                Text(String(text[text.index(after: separator)...])).font(.subheadline).lineSpacing(6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .textSelection(.enabled)
        } else {
            Text(text).font(.subheadline).lineSpacing(7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
        }
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
