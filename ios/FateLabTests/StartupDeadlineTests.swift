import XCTest
@testable import FateLab

private final class NeverEndingStartupProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{".utf8))
        // Simulates a response that starts but never finishes.
    }
    override func stopLoading() {}
}

@MainActor final class StartupDeadlineTests: XCTestCase {
    func testIncompleteResponseStopsAtTotalDeadline() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [NeverEndingStartupProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let start = ContinuousClock.now
        do {
            _ = try await APIClient.boundedData(for: URLRequest(url: URL(string: "https://test.invalid/startup")!), transport: session, timeout: .milliseconds(100))
            XCTFail("Incomplete response must time out")
        } catch APIError.timeout { }
        catch { XCTFail("Unexpected error: \(type(of: error))") }
        XCTAssertLessThan(start.duration(to: .now), .seconds(2))
    }

    func testTimeoutUsesRecoverableNetworkPresentation() {
        if case .network = errorStateKind(APIError.timeout) {} else { XCTFail("Expected network retry UI") }
        if case .network = errorStateKind(URLError(.timedOut)) {} else { XCTFail("Expected network retry UI") }
    }
}
