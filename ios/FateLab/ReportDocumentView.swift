import SwiftUI

struct ReportDocumentView: View {
    let report: GeneratedReport
    let questionTitle: String
    let isSaving: Bool
    let askQuestion: () -> Void
    var showsCompletionMessage = true

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            if showsCompletionMessage {
                Text("鑑定が完了しました").font(.caption).tracking(2).foregroundStyle(FateTheme.ink)
            }
            Text("命式鑑定書").font(FateType.screenTitle)
            birthSummary
            ForEach(report.cards) { card in
                StructuredReportCardView(card: card)
            }
            Button(isSaving ? "鑑定書を保存しています…" : questionTitle, action: askQuestion)
                .buttonStyle(FLPrimaryButtonStyle()).disabled(isSaving)
        }
    }

    private var birthSummary: some View {
        VStack(alignment: .leading, spacing: 5) {
            if let date = report.birthData["birthDate"] as? String { Text(date.replacingOccurrences(of: "-", with: "/") + " 生") }
            HStack {
                if let place = report.birthData["birthplace"] as? String { Text(place) }
                if let gender = report.birthData["gender"] as? String { Text("／ " + (gender == "female" ? "女性" : "男性")) }
            }
        }.font(.system(size: 14)).foregroundStyle(FateTheme.muted)
    }

}

private struct StructuredReportCardView: View {
    let card: ReadingCard

    var body: some View {
        VStack(alignment: .leading, spacing: FateSpacing.cardPadding) {
            Text(card.title).font(FateType.sectionTitle).lineSpacing(6)
            Text(card.summary).font(FateType.body).foregroundStyle(FateTheme.muted).lineSpacing(7)
            ForEach(Array(card.pages.enumerated()), id: \.offset) { _, page in
                VStack(alignment: .leading, spacing: 7) {
                    Text(page.label).font(.caption).tracking(2).foregroundStyle(FateTheme.ink)
                    Text(page.text).font(FateType.body).lineSpacing(8)
                }
            }
            if !card.evidence.isEmpty {
                DisclosureGroup("このカードで参照した内容") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(card.evidence.enumerated()), id: \.offset) { _, evidence in
                            Text("\(evidence.system) — \(evidence.detail)").font(.footnote).foregroundStyle(FateTheme.muted)
                        }
                    }.padding(.top, 10)
                }.font(.footnote)
            }
        }
        .padding(FateSpacing.cardPadding).background(FateTheme.canvas)
        .clipShape(RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }
}
