import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("profile completion web wiring", () => {
  const wizard = readFileSync("src/components/profile-completion/ProfileCompletionWizard.tsx", "utf8");
  const notice = readFileSync("src/components/profile-completion/ProfileCompletionNotice.tsx", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const profilePage = readFileSync("src/app/(app)/users/[id]/page.tsx", "utf8");

  it("mounts one desktop-only returning-user wizard in authenticated web chrome", () => {
    expect(shell).toContain("<ProfileCompletionWizard />");
    expect(wizard).toContain('matchMedia("(min-width: 768px)")');
    expect(wizard).toContain("data?.completion.shouldPrompt");
    expect(wizard).toContain("Remind me tomorrow");
    expect(wizard).toContain('step: "SNOOZE"');
    expect(wizard).not.toContain("Drawer");
    expect(wizard).not.toContain("Sheet");
  });

  it("keeps the requested role-aware field semantics", () => {
    expect(wizard).toContain('title: "Confirm your email addresses"');
    expect(wizard).toContain('title: "Add your phone numbers"');
    expect(wizard).toContain('title: "Link your Wiscard"');
    expect(wizard).toContain('title: "Add your student details"');
    expect(wizard).toContain('title: "Add your apparel sizes"');
    expect(wizard).toContain("Which number is it?");
    expect(wizard).toContain("I don’t have a work phone");
    expect(wizard).toContain('!isStudent && (');
    expect(wizard).toContain('title: "Add your phone number"');
    expect(wizard).toContain("Wiscard number");
    expect(wizard).toContain("Issue code");
    expect(wizard).not.toContain("scan or type");
    expect(wizard).not.toContain("Scan your");
    expect(wizard).toContain("Women’s");
    expect(wizard).not.toContain("US Women’s");
    expect(wizard).not.toContain("US Men’s");
    expect(wizard).toContain("Issue code can be found in the bottom right of your Wiscard");
    expect(wizard).toContain("formatPhoneInput(event.target.value)");
    expect(wizard).toContain("Anticipated graduation");
    expect(wizard).toContain("STUDENT_YEAR_OPTIONS");
    expect(wizard).toContain('profile.role === "STUDENT"');
  });

  it("keeps missing details visible on the signed-in user's web profile", () => {
    expect(profilePage).toContain("isSelf && <ProfileCompletionNotice />");
    expect(notice).toContain("Needed:");
    expect(notice).toContain("Complete profile");
    expect(notice).toContain("hidden");
    expect(notice).toContain("md:block");
    expect(notice).toContain("if (data.completion.isComplete) return null");
  });
});
