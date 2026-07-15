import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const submissionSource = readFileSync("tasks/app-store-connect-submission-content.md", "utf8");

describe("App Store submission content", () => {
  it("documents Apple's unlisted app request sequence", () => {
    expect(submissionSource).toContain("intended for unlisted app distribution");
    expect(submissionSource).toContain("Distribution during submission:** Public");
    expect(submissionSource).toContain("separate unlisted-distribution request");
    expect(submissionSource).not.toContain('Distribution tab → set to "Unlisted"');
  });

  it("gives App Review exact fictional scan resources", () => {
    for (const code of ["DEMO-CAM-001", "DEMO-LENS-001", "DEMO-AUDIO-001", "DEMO-BATT-1"]) {
      expect(submissionSource).toContain(code);
    }
    expect(submissionSource).toContain("tap Type Code");
  });

  it("defines the required iPhone and iPad screenshot sets", () => {
    expect(submissionSource).toContain("1320 x 2868");
    expect(submissionSource).toContain("2064 x 2752");
    expect(submissionSource).toContain("Seven-shot order for both device sets");
    expect(submissionSource).toContain("Users directory showing fictional staff and student roles");
  });

  it("uses explicit age-rating and legal-field answers instead of guesses", () => {
    expect(submissionSource).toContain("Unrestricted Web Access **No**");
    expect(submissionSource).toContain("User-Generated Content **No**");
    expect(submissionSource).toContain("Messaging and Chat **No**");
    expect(submissionSource).toContain("Age Categories and Override: **Not Applicable**");
    expect(submissionSource).toContain("ITSAppUsesNonExemptEncryption = false");
    expect(submissionSource).toContain("exact owner confirmed by the App Store Connect Account Holder");
    expect(submissionSource).not.toContain('Answer every questionnaire toggle "No."');
  });
});
