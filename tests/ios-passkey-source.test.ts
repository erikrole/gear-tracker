import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS passkey source contract", () => {
  it("uses Apple's platform credential provider for the shared WebAuthn ceremonies", () => {
    const service = source("ios/Wisconsin/Core/PasskeyService.swift");
    const models = source("ios/Wisconsin/Models/PasskeyModels.swift");

    expect(service).toContain("ASAuthorizationPlatformPublicKeyCredentialProvider");
    expect(service).toContain("createCredentialRegistrationRequest");
    expect(service).toContain("createCredentialAssertionRequest");
    expect(service).toContain("ASAuthorizationController");
    expect(service).toContain("request.userVerificationPreference = .required");
    expect(service).toContain("rawClientDataJSON");
    expect(service).toContain("attestationObject");
    expect(service).toContain("rawAuthenticatorData");
    expect(service).toContain("signature");
    expect(models).toContain("type = \"public-key\"");
    expect(models).toContain("clientExtensionResults: [String: String] = [:]");
  });

  it("keeps native login, enrollment, and management on the existing API contract", () => {
    const api = source("ios/Wisconsin/Core/APIClient.swift");
    const session = source("ios/Wisconsin/Core/SessionStore.swift");
    const login = source("ios/Wisconsin/Views/LoginView.swift");
    const security = source("ios/Wisconsin/Views/AccountSecuritySettingsView.swift");

    expect(api).toContain("/api/auth/passkey/login/options");
    expect(api).toContain("/api/auth/passkey/login/verify");
    expect(api).toContain("/api/auth/passkey/registration/options");
    expect(api).toContain("/api/auth/passkey/registration/verify");
    expect(api).toContain("/api/me/passkeys");
    expect(session).toContain("PasskeyService.shared.authenticate");
    expect(login).toContain("Continue with passkey");
    expect(security).toContain('Text("Passkeys")');
    expect(security).toContain("PasskeyService.shared.register");
    expect(security).toContain("revokePasskey");
    expect(security).toContain("catch APIError.notFound");
    expect(security).toContain("Passkey setup is not available on this server yet.");
    expect(security).toContain('TextField("Passkey name (optional)"');
    expect(security).toContain(".textContentType(nil)");
  });

  it("publishes the webcredentials association for the shipped bundle", () => {
    const project = source("ios/project.yml");
    const entitlements = source("ios/Wisconsin/Wisconsin.entitlements");
    const association = source("src/app/.well-known/apple-app-site-association/route.ts");

    for (const file of [project, entitlements]) {
      expect(file).toContain("webcredentials:wisconsincreative.com");
    }
    expect(association).toContain("T26T3G8C7Q.com.erikrole.Wisconsin");
    expect(association).toContain("webcredentials");
    expect(association).toContain('export const dynamic = "force-static"');
  });
});
