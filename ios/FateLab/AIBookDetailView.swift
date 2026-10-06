import SwiftUI

struct AIBookDetailView: View {
    let initial: AIBook
    var onUpdate: (AIBook) -> Void = { _ in }
    @EnvironmentObject private var auth: AuthStore
    @State private var updated: AIBook?
    @State private var error: String?
    private var book: AIBook { updated ?? initial }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if !book.isPending {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("あなたへの鑑定書").font(.caption).foregroundStyle(FateTheme.muted)
                        Text(book.title).font(.title2.weight(.medium)).lineSpacing(6)
                            .foregroundStyle(FateTheme.ink).fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        Text("\(book.targetTitle) · \(String(book.createdAt.prefix(10)))")
                            .font(.caption).foregroundStyle(FateTheme.muted)
                        FateArtwork(name: "QuietMountains").frame(height: 104).clipped()
                            .overlay(FateTheme.canvas.opacity(0.16))
                            .clipShape(RoundedRectangle(cornerRadius: FLRadius.card))
                            .accessibilityHidden(true)
                    }.padding(.bottom, 6)
                }
                if let doc = book.document, book.state == "delivered" {
                    let paragraphs = BookReadingText.paragraphs(doc.answer)
                    let conclusion = doc.conclusion ?? paragraphs.first ?? ""
                    VStack(alignment: .leading, spacing: 36) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("ご相談の要約").font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
                            Text(doc.summary.isEmpty ? book.question : doc.summary)
                                .font(.subheadline).lineSpacing(7).foregroundStyle(FateTheme.body)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        VStack(alignment: .leading, spacing: 16) {
                            Text("この鑑定の結論")
                                .font(.caption.weight(.medium)).foregroundStyle(FateTheme.muted)
                                .accessibilityAddTraits(.isHeader)
                            Text(conclusion).font(.body).lineSpacing(9)
                                .foregroundStyle(FateTheme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.leading, 18)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(FateTheme.muted.opacity(0.35)).frame(width: 2)
                        }
                        let detail = (doc.conclusion == nil ? Array(paragraphs.dropFirst()) : paragraphs).joined(separator: "\n\n")
                        if !detail.isEmpty {
                            readingSection("詳しく読み解く", text: detail)
                        }
                        ForEach(Array(doc.sections.enumerated()), id: \.offset) { _, section in
                            VStack(alignment: .leading, spacing: 18) {
                                readingSection(section.heading, text: section.body)
                                if let source = book.sources.first(where: { $0.id == section.sourceId }) {
                                    DisclosureGroup {
                                        Text(section.quote).font(.footnote).lineSpacing(6).padding(.top, 10)
                                    } label: {
                                        Label("もとになった鑑定：\(source.title)", systemImage: "book.closed")
                                    }.font(.caption).foregroundStyle(FateTheme.muted).tint(FateTheme.muted)
                                }
                            }
                        }
                        if !doc.actions.isEmpty {
                            VStack(alignment: .leading, spacing: 20) {
                                sectionHeading("試してみたいこと")
                                ForEach(Array(doc.actions.enumerated()), id: \.offset) { index, action in
                                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                                        Text(String(format: "%02d", index + 1))
                                            .font(.caption.monospacedDigit()).foregroundStyle(FateTheme.muted)
                                        Text(BookReadingText.styled(action, highlights: doc.highlights ?? [], useFallback: false)).font(.body).lineSpacing(8).foregroundStyle(FateTheme.body)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                            }
                        }
                    }.padding(.horizontal, 4)
                    Text("計算結果と確認済みの鑑定原稿をもとにAIが構成しています。").font(.caption).foregroundStyle(FateTheme.muted)
                } else {
                    if book.isPending { BookGenerationStatusView(state: book.state) }
                    else if book.state == "delivered" { ProgressView("本を開いています") }
                    else if book.state == "failed" { Text("利用枠をお戻ししました。返却された枠の期限は本棚で確認できます。相談内容を見直して、もう一度お試しください。") }
                    DisclosureGroup("ご相談の内容") { Text(book.question).lineSpacing(7).padding(.top, 12) }.font(.subheadline)
                }
                if let error { Text(error).font(.footnote).foregroundStyle(FateTheme.danger) }
            }.frame(maxWidth: 620).padding(.horizontal, 24).padding(.top, 24).padding(.bottom, 48)
                .frame(maxWidth: .infinity).textSelection(.enabled)
        }
#if DEBUG
        .defaultScrollAnchor(ProcessInfo.processInfo.arguments.contains("--reader-bottom-preview") ? .bottom : .top)
#endif
        .background(FateTheme.canvas).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) { FateMark(size: 24); Text("FATE LAB").font(.system(size: 12, weight: .medium)).tracking(3) }
                }
            }
            .task(id: AccountScope(auth)) {
#if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--ui-delivered89-preview") { return }
#endif
                let owner = AccountScope(auth)
                while !Task.isCancelled && owner.isCurrent(auth) {
                    do {
                        let result = try await APIClient.shared.bookCall(AIBookResponse.self, path: "/\(initial.id.uuidString)", auth: auth)
                        try owner.check(auth)
                        guard let fetched = result.book else { error = "鑑定書を確認できませんでした。本棚から開き直してください。"; break }
                        updated = fetched; error = nil; onUpdate(fetched)
                        if !fetched.isPending { break }
                    } catch is CancellationError { break }
                    catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
                    do { try await Task.sleep(for: .seconds(8)) } catch { break }
                }
            }
            .refreshable {
                do { updated = try await APIClient.shared.bookCall(AIBookResponse.self, path: "/\(initial.id.uuidString)", auth: auth).book; error = nil; if let updated { onUpdate(updated) } }
                catch { self.error = userFacingErrorMessage(error) }
            }
    }
    private func sectionHeading(_ title: String) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Rectangle().fill(FateTheme.line).frame(height: 1)
            Text(title).font(.headline.weight(.medium)).lineSpacing(5)
                .foregroundStyle(FateTheme.ink).accessibilityAddTraits(.isHeader)
        }
    }

    private func readingSection(_ title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionHeading(title)
            VStack(alignment: .leading, spacing: 22) {
                ForEach(Array(BookReadingText.paragraphs(text).enumerated()), id: \.offset) { _, paragraph in
                    Text(BookReadingText.styled(paragraph, highlights: book.document?.highlights ?? [], useFallback: paragraph == BookReadingText.paragraphs(text).first)).font(.body).lineSpacing(8).foregroundStyle(FateTheme.body)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

}


struct BookGenerationStatusView: View {
    let state: String
    private var detail: String {
        switch state {
        case "queued": "ご相談を受け付けました。順番に作成を始めます。"
        case "review": "文章の内容を確認しています。"
        default: "ご相談と鑑定結果を照らし合わせています。"
        }
    }
    var body: some View {
        VStack(spacing: 8) {
            FateLoadingView(title: "あなたへの鑑定書を\nつくっています", detail: detail)
            Text("数分かかることがあります。\nアプリを閉じても作成は続き、完成した一冊は本棚に残ります。")
                .font(.footnote).foregroundStyle(FateTheme.muted).multilineTextAlignment(.center).lineSpacing(5)
                .padding(.horizontal, 20).padding(.bottom, 24)
        }.frame(maxWidth: .infinity).background { FateLoadingBackground() }
    }
}

// Presentation only: saved source documents are never rewritten.
enum BookReadingText {
    static func paragraphs(_ text: String) -> [String] {
        text.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !($0.hasPrefix("まず前提として") && ($0.contains("断定") || $0.contains("保証"))) }
    }
    static func styled(_ text: String, highlights: [String], useFallback: Bool = true) -> AttributedString {
        var result = AttributedString(text)
        let fallback = text.components(separatedBy: "。").first.map { $0 + (text.contains("。") ? "。" : "") } ?? ""
        let phrases = highlights.isEmpty ? (useFallback && fallback.count <= 100 ? [fallback] : []) : highlights
        for phrase in phrases where !phrase.isEmpty {
            if let range = result.range(of: phrase) { result[range].backgroundColor = Color(red: 0.96, green: 0.87, blue: 0.59).opacity(0.45) }
        }
        return result
    }
}
