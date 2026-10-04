import AuthenticationServices
import UIKit

@MainActor
final class AuthWebFlow: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var active: ASWebAuthenticationSession?
    private var completion: CheckedContinuation<URL, Error>?
    private var operation: UUID?
    private var anchor: UIWindow?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }
    func launch(_ url: URL) async throws -> URL {
        guard active == nil else { throw CancellationError() }
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .filter({ $0.activationState == .foregroundActive }).flatMap(\.windows).first(where: \.isKeyWindow) else {
            throw NSError(domain: ASWebAuthenticationSessionError.errorDomain,
                          code: ASWebAuthenticationSessionError.presentationContextNotProvided.rawValue)
        }
        anchor = window
        let id = UUID(); operation = id
        return try await withCheckedThrowingContinuation { continuation in
            completion = continuation
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "fatelab") { [weak self] url, error in
                Task { @MainActor in
                    guard let self, self.operation == id else { return }
                    if let error { self.finish(.failure(error)); return }
                    guard let url else { self.finish(.failure(AuthCallback.invalid())); return }
                    do { _ = try AuthCallback.code(from: url); self.finish(.success(url)) }
                    catch { self.finish(.failure(error)) }
                }
            }
            active = session
            session.presentationContextProvider = self
            if !session.start() { finish(.failure(NSError(domain: ASWebAuthenticationSessionError.errorDomain,
                code: ASWebAuthenticationSessionError.presentationContextInvalid.rawValue))) }
        }
    }
    private func finish(_ result: Result<URL, Error>) {
        let pending = completion
        completion = nil; operation = nil; active = nil; anchor = nil
        pending?.resume(with: result)
    }
    func cancel() {
        let session = active
        finish(.failure(CancellationError()))
        session?.cancel()
    }
}
