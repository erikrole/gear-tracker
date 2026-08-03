import Foundation

struct PasskeyRelyingParty: Decodable {
    let id: String
    let name: String?
}

struct PasskeyUserEntity: Decodable {
    let id: String
    let name: String
    let displayName: String
}

struct PasskeyRegistrationOptions: Decodable {
    let challenge: String
    let rp: PasskeyRelyingParty
    let user: PasskeyUserEntity
}

struct PasskeyAuthenticationOptions: Decodable {
    let challenge: String
    let rpId: String
}

struct PasskeyCredentialSummary: Codable, Identifiable, Equatable {
    let id: String
    let name: String?
    let createdAt: Date
    let lastUsedAt: Date?
    let deviceType: String?
    let backedUp: Bool
}

struct PasskeyRegistrationConfirmation: Decodable {
    let id: String
    let name: String?
    let createdAt: Date
}

struct PasskeyRegistrationPayload: Encodable {
    struct Response: Encodable {
        let clientDataJSON: String
        let attestationObject: String
    }

    let id: String
    let rawId: String
    let response: Response
    let type = "public-key"
    let clientExtensionResults: [String: String] = [:]
    let authenticatorAttachment: String? = nil
}

struct PasskeyAssertionPayload: Encodable {
    struct Response: Encodable {
        let clientDataJSON: String
        let authenticatorData: String
        let signature: String
        let userHandle: String?
    }

    let id: String
    let rawId: String
    let response: Response
    let type = "public-key"
    let clientExtensionResults: [String: String] = [:]
    let authenticatorAttachment: String? = nil
}
