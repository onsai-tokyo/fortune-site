import XCTest
@testable import FateLab

final class ServerEventsTests: XCTestCase {
    private func parse(_ wire: String) throws -> (ServerEventParser, [ServerEvent]) {
        var parser = ServerEventParser(), events: [ServerEvent] = []
        for byte in wire.utf8 { if let event = try parser.push(byte) { events.append(event) } }
        return (parser, events)
    }
    func testSplitUTF8CRLFCommentsAndMultilineData() throws {
        let (parser, events) = try parse(": heartbeat\r\ndata:{\r\ndata: \"delta\":{\"text\":\"日本語🌸\"}}\r\n\r\ndata: [DONE]\r\n\r\n")
        guard case .delta(let text) = events.first else { return XCTFail("missing delta") }
        XCTAssertEqual(text, "日本語🌸")
        XCTAssertTrue(parser.ended)
        try parser.finish(complete: true)
    }
    func testEOFBeforeCompletionIsNotSuccess() throws {
        let (parser, _) = try parse("data: {\"delta\":{\"text\":\"partial\"}}\n\n")
        XCTAssertThrowsError(try parser.finish(complete: false))
        let (truncated, _) = try parse("data: [DONE]")
        XCTAssertThrowsError(try truncated.finish(complete: true))
    }
    func testCompleteReportCanSurviveLostDONE() throws {
        let (parser, events) = try parse("data: {\"type\":\"complete\",\"report\":{\"version\":3,\"cards\":[],\"reportText\":\"body\"}}\n\n")
        guard case .report = events.first else { return XCTFail("missing report") }
        try parser.finish(complete: true)
        XCTAssertFalse(parser.ended)
    }
    func testErrorMalformedJSONAndInvalidUTF8Reject() throws {
        XCTAssertThrowsError(try parse("data: {\"error\":\"failed\"}\n\ndata: [DONE]\n\n"))
        XCTAssertThrowsError(try parse("data: {bad}\n\n"))
        var parser = ServerEventParser()
        _ = try parser.push(255)
        XCTAssertThrowsError(try parser.push(10))
    }
    func testOversizedFrameAndEventsAfterDONEReject() throws {
        XCTAssertThrowsError(try parse("data: [DONE]\n\ndata: {\"meta\":{}}\n\n"))
        XCTAssertThrowsError(try parse("data:" + String(repeating: "x", count: 2_000_001)))
    }
}
