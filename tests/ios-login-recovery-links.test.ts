import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS login recovery links", () => {
  const source = readFileSync("ios/Wisconsin/Views/LoginView.swift", "utf8");

  it("keeps password reset and allowlist registration reachable from native login", () => {
    expect(source).toContain('URL(string: "https://gear.erikrole.com/forgot-password")');
    expect(source).toContain('URL(string: "https://gear.erikrole.com/register")');
    expect(source).toContain('Link("Forgot password?", destination: Self.forgotPasswordURL)');
    expect(source).toContain('Link("Need an account?", destination: Self.registerURL)');
  });

  it("names the password visibility control by action and state", () => {
    expect(source).toContain('.accessibilityLabel(showPassword ? "Hide password" : "Show password")');
    expect(source).toContain('.accessibilityValue(showPassword ? "Password visible" : "Password hidden")');
  });
});
