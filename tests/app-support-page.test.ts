import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supportPageSource = readFileSync("src/app/support/page.tsx", "utf8");
const submissionSource = readFileSync("tasks/app-store-connect-submission-content.md", "utf8");

describe("App Store support page", () => {
  it("publishes a direct contact path without exposing credentials", () => {
    expect(supportPageSource).toContain('const supportEmail = "erole@athletics.wisc.edu"');
    expect(supportPageSource).toContain("mailto:${supportEmail}");
    expect(supportPageSource).toContain("Do not send");
    expect(supportPageSource).toContain('href="/privacy"');
  });

  it("uses the dedicated support page in submission metadata", () => {
    expect(submissionSource).toContain("https://wisconsincreative.com/support");
    expect(submissionSource).not.toContain("Support URL:** `https://wisconsincreative.com/about`");
  });
});
