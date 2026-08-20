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
                Text("鑑定が完了しました").font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
            }
            Text("命式鑑定書").font(.system(size: 32, weight: .medium, design: .serif))
            birthSummary
            ForEach(report.cards) { card in
                StructuredReportCardView(card: card)
            }
            if !report.calculatedData.isEmpty {
                DisclosureGroup("命式・計算データ") {
                    Text(formattedCalculatedData)
                        .font(.system(size: 14, design: .monospaced))
                        .lineSpacing(6).textSelection(.enabled).padding(.top, 12)
                }
                .font(.system(size: 18, weight: .medium, design: .serif))
                .padding(18).background(FateTheme.paper)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(FateTheme.line))
            }
            Button(isSaving ? "鑑定書を保存しています…" : questionTitle, action: askQuestion)
                .buttonStyle(GoldButtonStyle()).disabled(isSaving)
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

    private var formattedCalculatedData: String {
        guard JSONSerialization.isValidJSONObject(report.calculatedData),
              let data = try? JSONSerialization.data(withJSONObject: report.calculatedData, options: [.prettyPrinted, .sortedKeys]),
              let value = String(data: data, encoding: .utf8) else { return "計算データを表示できません" }
        return value
    }
}

private struct StructuredReportCardView: View {
    let card: ReadingCard

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(card.title).font(.system(size: 24, weight: .medium, design: .serif)).lineSpacing(6)
            Text(card.summary).font(.system(size: 16)).foregroundStyle(FateTheme.muted).lineSpacing(7)
            ForEach(Array(card.pages.enumerated()), id: \.offset) { _, page in
                VStack(alignment: .leading, spacing: 7) {
                    Text(page.label).font(.caption).tracking(2).foregroundStyle(FateTheme.gold)
                    Text(page.text).font(.system(size: 16)).lineSpacing(8)
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
        .padding(20).background(FateTheme.ivory)
        .clipShape(RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(FateTheme.line))
    }
}
