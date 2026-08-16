import Foundation
import OSLog

struct ReportDocument {
    let preface: [ReportNode]
    let chapters: [ReportChapter]
    let sourceCharacterCount: Int
}

struct ReportChapter: Identifiable {
    let id: String
    let title: String
    var nodes: [ReportNode]

    var yearCount: Int { nodes.reduce(0) { $0 + ($1.isYear ? 1 : 0) } }
    var turningCount: Int { nodes.reduce(0) { $0 + ($1.isTurning ? 1 : 0) } }
    var detail: String? {
        if yearCount > 0 { return turningCount > 0 ? "\(yearCount)の年・転換期 \(turningCount)つ" : "\(yearCount)の年" }
        return nodes.isEmpty ? nil : "全文を読む"
    }
}

indirect enum ReportNode {
    case subsection(String)
    case paragraph([ReportInline])
    case bullet([ReportInline])
    case advice([ReportInline])
    case evidence(EvidenceGroups)
    case year(ReportYearCard)

    var isYear: Bool { if case .year = self { true } else { false } }
    var isTurning: Bool { if case .year(let value) = self { value.isTurning } else { false } }
}

enum ReportInline {
    case text(String)
    case highlight(String)

    var plainText: String { switch self { case .text(let value), .highlight(let value): value } }
}

struct ReportYearCard {
    var year: String
    var summary = ""
    var domains: [String] = []
    var body: [ReportNode] = []
    var isTurning = false
}

struct EvidenceGroups {
    struct Item { let system: String; let detail: String }
    struct Group: Identifiable { let id: String; let family: String; var items: [Item] }
    var groups: [Group]
}

enum ReportParser {
    private static let logger = Logger(subsystem: "com.onsai.fatelab", category: "ReportParser")
    private static let marker = try! NSRegularExpression(pattern: #"\[\[([A-Z]+):([\s\S]*?)\]\]"#)

    static func parse(_ source: String) -> ReportDocument {
        let lines = source.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        var preface: [ReportNode] = []
        var chapters: [ReportChapter] = []
        var currentTitle: String?
        var currentNodes: [ReportNode] = []
        var currentYear: ReportYearCard?
        var paragraphLines: [String] = []

        func flushParagraph() {
            guard !paragraphLines.isEmpty else { return }
            // The report generator uses both blank lines and a single newline
            // as semantic paragraph boundaries. Keeping single newlines inside
            // one Text view removes the visual pause between distinct thoughts.
            for paragraphLine in paragraphLines {
                let text = paragraphLine.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { append(.paragraph(parseInlines(text))) }
            }
            paragraphLines.removeAll()
        }
        func flushYear() {
            guard let year = currentYear else { return }
            currentNodes.append(.year(year)); currentYear = nil
        }
        func flushChapter() {
            flushParagraph(); flushYear()
            guard let title = currentTitle else {
                preface.append(contentsOf: currentNodes); currentNodes.removeAll(); return
            }
            chapters.append(ReportChapter(id: "chapter-\(chapters.count)-\(title)", title: title, nodes: currentNodes))
            currentNodes.removeAll()
        }
        func append(_ node: ReportNode) {
            if currentYear != nil { currentYear!.body.append(node) } else { currentNodes.append(node) }
        }

        for rawLine in lines {
            var line = rawLine.trimmingCharacters(in: .whitespaces)
            line = line.replacingOccurrences(of: "画面上部の「命式・計算データ」", with: "「命式・計算データ」章")
            if line.isEmpty { flushParagraph(); continue }
            if line.hasPrefix("【"), line.hasSuffix("】") {
                flushChapter(); currentTitle = String(line.dropFirst().dropLast()); continue
            }
            if line.hasPrefix("〈"), line.hasSuffix("〉") {
                flushParagraph(); flushYear(); append(.subsection(String(line.dropFirst().dropLast()))); continue
            }
            let markers = markerValues(in: line)
            if let yearMarker = markers.first(where: { $0.name == "YEAR" || $0.name == "TURNING" }) {
                flushParagraph(); flushYear()
                currentYear = ReportYearCard(year: yearMarker.content, isTurning: yearMarker.name == "TURNING")
                continue
            }
            if currentYear != nil, !markers.isEmpty {
                var consumed = false
                for value in markers {
                    switch value.name {
                    case "SUMMARY": currentYear!.summary = value.content; consumed = true
                    case "DOMAIN": currentYear!.domains.append(value.content); consumed = true
                    case "EVIDENCE": currentYear!.body.append(.evidence(parseEvidence(value.content))); consumed = true
                    default: break
                    }
                }
                let remainder = removingMarkers(from: line).trimmingCharacters(in: .whitespaces)
                if consumed, remainder.isEmpty { continue }
                if consumed, !remainder.isEmpty { paragraphLines.append(remainder); continue }
            }
            if markers.count == 1, markers[0].name == "EVIDENCE", removingMarkers(from: line).trimmingCharacters(in: .whitespaces).isEmpty {
                flushParagraph(); append(.evidence(parseEvidence(markers[0].content))); continue
            }
            if line.hasPrefix("- ") {
                flushParagraph(); append(.bullet(parseInlines(String(line.dropFirst(2))))); continue
            }
            if line.hasPrefix("▸ ") {
                flushParagraph(); append(.advice(parseInlines(String(line.dropFirst(2))))); continue
            }
            paragraphLines.append(line)
        }
        flushChapter()
        if currentTitle == nil, !currentNodes.isEmpty { preface.append(contentsOf: currentNodes) }
        return ReportDocument(preface: preface, chapters: chapters, sourceCharacterCount: source.count)
    }

    static func plainText(from source: String) -> String {
        let document = parse(source)
        return (document.preface + document.chapters.flatMap(\.nodes)).map(plainText).joined(separator: "\n")
    }

    private static func plainText(_ node: ReportNode) -> String {
        switch node {
        case .subsection(let value): value
        case .paragraph(let values), .bullet(let values), .advice(let values): values.map(\.plainText).joined()
        case .evidence(let value): value.groups.flatMap { $0.items.map { "\($0.system) \($0.detail)" } }.joined(separator: " ")
        case .year(let value): ([value.year, value.summary] + value.domains + value.body.map(plainText)).joined(separator: " ")
        }
    }

    private static func parseInlines(_ text: String) -> [ReportInline] {
        let ns = text as NSString
        let matches = marker.matches(in: text, range: NSRange(location: 0, length: ns.length))
        var result: [ReportInline] = []; var cursor = 0
        for match in matches {
            if match.range.location > cursor { result.append(.text(ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor)))) }
            let name = ns.substring(with: match.range(at: 1)); let content = ns.substring(with: match.range(at: 2))
            if name == "HIGHLIGHT" { result.append(.highlight(content)) }
            else if name == "EVIDENCE" { /* rendered as its own node when standalone */ }
            else { logger.error("Unknown report marker: \(name, privacy: .public)"); result.append(.text(content)) }
            cursor = match.range.location + match.range.length
        }
        if cursor < ns.length { result.append(.text(ns.substring(from: cursor))) }
        return result.isEmpty ? [.text(text)] : result
    }

    private static func markerValues(in text: String) -> [(name: String, content: String)] {
        let ns = text as NSString
        return marker.matches(in: text, range: NSRange(location: 0, length: ns.length)).map {
            (ns.substring(with: $0.range(at: 1)), ns.substring(with: $0.range(at: 2)))
        }
    }

    private static func removingMarkers(from text: String) -> String {
        marker.stringByReplacingMatches(in: text, range: NSRange(location: 0, length: (text as NSString).length), withTemplate: "")
    }

    private static func parseEvidence(_ content: String) -> EvidenceGroups {
        var groups: [EvidenceGroups.Group] = []
        for entry in content.components(separatedBy: "||") {
            let fields = entry.components(separatedBy: "｜")
            guard fields.count >= 3 else { continue }
            let family = familyLabel(fields[0]); let item = EvidenceGroups.Item(system: fields[1], detail: fields.dropFirst(2).joined(separator: "｜"))
            if let index = groups.firstIndex(where: { $0.id == family }) { groups[index].items.append(item) }
            else { groups.append(.init(id: family, family: family, items: [item])) }
        }
        return EvidenceGroups(groups: groups)
    }

    private static func familyLabel(_ raw: String) -> String {
        switch raw { case "干支系": "暦（こよみ）"; case "天体系": "天体"; case "数理系": "数"; case "宿曜系": "宿"; default: raw }
    }
}
