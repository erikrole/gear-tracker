import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS login recovery links", () => {
  const source = readFileSync("ios/Wisconsin/Views/LoginView.swift", "utf8");
  const apiClient = readFileSync("ios/Wisconsin/Core/APIClient.swift", "utf8");

  it("keeps password reset and allowlist registration reachable from native login", () => {
    expect(source).toContain('private static let forgotPasswordURL = AppEnvironment.url(path: "/forgot-password")');
    expect(source).toContain('private static let registerURL = AppEnvironment.url(path: "/register")');
    expect(source).toContain('Link("Forgot password?", destination: Self.forgotPasswordURL)');
    expect(source).toContain('Link("Need an account?", destination: Self.registerURL)');
  });

  it("names the password visibility control by action and state", () => {
    expect(source).toContain('.accessibilityLabel(showPassword ? "Hide password" : "Show password")');
    expect(source).toContain('.accessibilityValue(showPassword ? "Password visible" : "Password hidden")');
  });

  it("shows credential failures without broadcasting a session expiry", () => {
    expect(apiClient).toContain("perform(req, broadcastsSessionExpiry: false)");
    expect(apiClient).toContain("if broadcastsSessionExpiry {");
    expect(apiClient).toContain('?? "Invalid credentials"');
  });
});
