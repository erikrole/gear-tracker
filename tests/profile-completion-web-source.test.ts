import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("profile completion web wiring", () => {
  const wizard = readFileSync("src/components/profile-completion/ProfileCompletionWizard.tsx", "utf8");
  const notice = readFileSync("src/components/profile-completion/ProfileCompletionNotice.tsx", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const profilePage = readFileSync("src/app/(app)/users/[id]/page.tsx", "utf8");

  it("mounts one desktop-only returning-user wizard in authenticated web chrome", () => {
    expect(shell).toContain('pathname !== "/welcome" && <ProfileCompletionWizard />');
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
    expect(wizard).toContain('title: "Add a profile photo"');
    expect(wizard).toContain("Skip for now");
    expect(wizard).toContain("Which number is it?");
    expect(wizard).toContain("I don’t have a work phone");
    expect(wizard).toContain('!hasSimplePhoneStep && (');
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
    expect(wizard).toContain("visibleProfileSteps(data.profile.role)");
  });

  it("connects wizard steps with restrained directional motion", () => {
    expect(wizard).toContain('import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"');
    expect(wizard).toContain("type StepDirection = -1 | 1");
    expect(wizard).toContain("const reduceMotion = Boolean(useReducedMotion())");
    expect(wizard).toContain("setStepDirection(direction)");
    expect(wizard.match(/<AnimatePresence initial=\{false\} custom=\{stepMotionContext\}>/g)).toHaveLength(2);
    expect(wizard).toContain("translate3d(0, ${direction * 4}px, 0)");
    expect(wizard).toContain("translate3d(0, ${direction * -4}px, 0)");
    expect(wizard).toContain("duration: reduceMotion ? 0.12 : 0.2");
    expect(wizard).toContain("duration: 0.12");
    expect(wizard).toContain("reduceMotion ? {} : { transform:");
    expect(wizard).not.toContain('mode="wait"');
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
