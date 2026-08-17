import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTH_EMAIL_DOMAIN_NOTE, shouldSuggestWiscEmail } from "@/lib/auth-email-guidance";

describe("auth email domain guidance", () => {
  it("matches only the exact athletics email domain", () => {
    expect(shouldSuggestWiscEmail("student@athletics.wisc.edu")).toBe(true);
    expect(shouldSuggestWiscEmail(" STUDENT@ATHLETICS.WISC.EDU ")).toBe(true);
    expect(shouldSuggestWiscEmail("collaborator@example.com")).toBe(false);
    expect(shouldSuggestWiscEmail("student@wisc.edu")).toBe(false);
    expect(shouldSuggestWiscEmail("student@athletics.wisc.edu.example.com")).toBe(false);
  });

  it("wires the live note into web and native auth forms", () => {
    const webSources = [
      readFileSync("src/app/login/LoginForm.tsx", "utf8"),
      readFileSync("src/app/forgot-password/page.tsx", "utf8"),
    ];
    const nativeLogin = readFileSync("ios/Wisconsin/Views/LoginView.swift", "utf8");
    const nativeAuth = readFileSync("ios/Wisconsin/Views/NativeAuthViews.swift", "utf8");

    for (const source of webSources) {
      expect(source).toContain("shouldSuggestWiscEmail");
      expect(source).toContain("AUTH_EMAIL_DOMAIN_NOTE");
      expect(source).toContain("shouldSuggestWiscEmail(email) &&");
      expect(source).not.toContain("showEmailDomainTip");
    }
    expect(nativeLogin).toContain("AuthEmailDomainNote(email: email)");
    expect(nativeLogin).not.toContain("showEmailDomainTip");
    expect(nativeLogin.indexOf("AuthEmailDomainNote(email: email)")).toBeLessThan(nativeLogin.indexOf('Button("Forgot password?")'));
    expect(nativeAuth).toContain("AuthEmailGuidance.shouldSuggestWiscEmail");
    expect(nativeAuth).toContain("AuthEmailDomainNote(email: email)");
    expect(nativeAuth).not.toContain("showEmailDomainTip");
    expect(nativeAuth).toContain('static let note = "Login using your @wisc.edu email address."');
    expect(AUTH_EMAIL_DOMAIN_NOTE).toBe("Login using your @wisc.edu email address.");
  });
});
