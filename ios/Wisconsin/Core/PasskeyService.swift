import AuthenticationServices
import Foundation
import UIKit

enum PasskeyServiceError: LocalizedError {
    case unavailable
    case cancelled
    case invalidServerOptions
    case unsupportedCredential
    case authorizationFailed(Error)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            "Passkeys are not available on this device. Use your password instead."
        case .cancelled:
            "Passkey sign-in was canceled."
        case .invalidServerOptions, .unsupportedCredential:
            "The passkey request could not be completed. Try again."
        case .authorizationFailed(let error):
            error.localizedDescription
        }
    }
}

/// Owns the short-lived AuthenticationServices controller and converts Apple's
/// native credentials into the JSON shape consumed by the shared WebAuthn API.
/// The server remains responsible for challenge, origin, RP ID, user
/// verification, credential, and session validation.
@MainActor
final class PasskeyService: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = PasskeyService()

    private var authorizationController: ASAuthorizationController?
    private var continuation: CheckedContinuation<ASAuthorization, Error>?
    private var presentationWindow: UIWindow?

    func register(options: PasskeyRegistrationOptions) async throws -> PasskeyRegistrationPayload {
        guard let challenge = Base64URL.decode(options.challenge),
              let userID = Base64URL.decode(options.user.id) else {
            throw PasskeyServiceError.invalidServerOptions
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: options.rp.id
        )
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: options.user.name,
            userID: userID
        )
        let authorization = try await perform(request)
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            throw PasskeyServiceError.unsupportedCredential
        }
        guard let attestationObject = credential.rawAttestationObject else {
            throw PasskeyServiceError.unsupportedCredential
        }

        let id = Base64URL.encode(credential.credentialID)
        return PasskeyRegistrationPayload(
            id: id,
            rawId: id,
            response: .init(
                clientDataJSON: Base64URL.encode(credential.rawClientDataJSON),
                attestationObject: Base64URL.encode(attestationObject)
            )
        )
    }

    func authenticate(options: PasskeyAuthenticationOptions) async throws -> PasskeyAssertionPayload {
        guard let challenge = Base64URL.decode(options.challenge) else {
            throw PasskeyServiceError.invalidServerOptions
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: options.rpId
        )
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        request.userVerificationPreference = .required

        let authorization = try await perform(request)
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PasskeyServiceError.unsupportedCredential
        }

        let id = Base64URL.encode(credential.credentialID)
        let userHandle: String?
        if let userID = credential.userID, !userID.isEmpty {
            userHandle = Base64URL.encode(userID)
        } else {
            userHandle = nil
        }
        return PasskeyAssertionPayload(
            id: id,
            rawId: id,
            response: .init(
                clientDataJSON: Base64URL.encode(credential.rawClientDataJSON),
                authenticatorData: Base64URL.encode(credential.rawAuthenticatorData),
                signature: Base64URL.encode(credential.signature),
                userHandle: userHandle
            )
        )
    }

    private func perform(_ request: ASAuthorizationRequest) async throws -> ASAuthorization {
        guard continuation == nil else {
            throw PasskeyServiceError.unavailable
        }
        guard let window = Self.activeWindow else {
            throw PasskeyServiceError.unavailable
        }

        let controller = ASAuthorizationController(authorizationRequests: [request])
        authorizationController = controller
        presentationWindow = window
        controller.delegate = self
        controller.presentationContextProvider = self

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        finish(.success(authorization))
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        if let authorizationError = error as? ASAuthorizationError,
           authorizationError.code == .canceled {
            finish(.failure(PasskeyServiceError.cancelled))
        } else {
            finish(.failure(PasskeyServiceError.authorizationFailed(error)))
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let presentationWindow {
            return presentationWindow
        }
        if let activeWindow = Self.activeWindow {
            return activeWindow
        }
        guard let windowScene = Self.activeWindowScene else {
            preconditionFailure("Passkey authorization requires an active window scene")
        }
        return UIWindow(windowScene: windowScene)
    }

    private func finish(_ result: Result<ASAuthorization, Error>) {
        let continuation = continuation
        self.continuation = nil
        authorizationController = nil
        presentationWindow = nil
        continuation?.resume(with: result)
    }

    private static var activeWindowScene: UIWindowScene? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })
    }

    private static var activeWindow: UIWindow? {
        activeWindowScene?.windows.first(where: \.isKeyWindow)
    }
}

private enum Base64URL {
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
    }

    static func decode(_ string: String) -> Data? {
        var value = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        value += String(repeating: "=", count: (4 - value.count % 4) % 4)
        return Data(base64Encoded: value)
    }
}
