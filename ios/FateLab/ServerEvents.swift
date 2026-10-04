import Foundation

enum ServerEvent {
    case progress(GenerationProgress)
    case report(Data, String?)
    case delta(String)
    case meta([String])
    case done
}

/// Byte framing keeps split UTF-8 characters intact and preserves SSE blank lines.
struct ServerEventParser {
    private var line: [UInt8] = []
    private var dataLines: [String] = []
    private var size = 0
    private(set) var ended = false
    private let maximumEventBytes = 2_000_000

    mutating func push(_ byte: UInt8) throws -> ServerEvent? {
        size += 1
        guard size <= maximumEventBytes else { throw APIError.invalidResponse }
        if byte != 10 { line.append(byte); return nil }
        if line.last == 13 { line.removeLast() }
        guard let text = String(bytes: line, encoding: .utf8) else { throw APIError.invalidResponse }
        line.removeAll(keepingCapacity: true)
        if text.isEmpty {
            size = 0
            guard !dataLines.isEmpty else { return nil }
            let payload = dataLines.joined(separator: "\n")
            dataLines.removeAll(keepingCapacity: true)
            guard !ended else { throw APIError.invalidResponse }
            if payload == "[DONE]" { ended = true; return .done }
            guard let data = payload.data(using: .utf8),
                  let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw APIError.invalidResponse }
            if let error = object["error"] as? String { throw APIError.server(error) }
            if object["type"] as? String == "progress", let percent = object["percent"] as? Int {
                return .progress(.init(percent: percent, title: object["title"] as? String ?? "鑑定中", detail: object["detail"] as? String ?? ""))
            }
            if object["type"] as? String == "complete", let report = object["report"] as? [String: Any] {
                return .report(try JSONSerialization.data(withJSONObject: report), object["conversationId"] as? String)
            }
            if let delta = object["delta"] as? [String: Any], let text = delta["text"] as? String { return .delta(text) }
            if let meta = object["meta"] as? [String: Any] { return .meta(meta["suggestions"] as? [String] ?? []) }
            throw APIError.invalidResponse
        }
        if text.hasPrefix(":") { return nil }
        let pieces = text.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        if pieces[0] == "data" {
            var value = pieces.count == 2 ? String(pieces[1]) : ""
            if value.hasPrefix(" ") { value.removeFirst() }
            dataLines.append(value)
        }
        return nil
    }

    func finish(complete: Bool) throws {
        // A typed report is a complete result even if its trailing DONE was lost.
        guard complete, line.isEmpty, dataLines.isEmpty else { throw APIError.incompleteStream }
    }
}
