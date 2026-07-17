import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("onboarding status page source wiring", () => {
  it("renders a dedicated onboarding status route from the allowlist source of truth", () => {
    const source = readFileSync("src/app/(app)/users/onboarding-status/page.tsx", "utf8");

    expect(source).toContain("Onboarding Status");
    expect(source).toContain('url: "/api/allowed-emails?limit=500"');
    expect(source).toContain("const STALE_DAYS = 14");
    expect(source).toContain("Stale pending");
    expect(source).toContain("Pending");
    expect(source).toContain("Claimed");
    expect(source).toContain("OperationalMetricCard");
    expect(source).toContain('name="onboardingStatusSearch"');
    expect(source).toContain('aria-label="Onboarding status filter"');
    expect(source).toContain('if (status === "claimed") return <Badge variant="gray">Claimed</Badge>;');
    expect(source).toContain("createdBy.name");
    expect(source).toContain("claimedBy.name");
    expect(source).toContain("Copy registration link");
    expect(source).toContain("Remove pending invite");
    expect(source).toContain("navigator.clipboard.writeText(`${window.location.origin}${registrationPath(row)}`)");
    expect(source).toContain("row.collaboratorPolicy?.affiliation.badgeLabel");
    expect(source).not.toContain('params.set("profile", "btn")');
    expect(source).toContain("fetch(`/api/allowed-emails/${row.id}`, { method: \"DELETE\" })");
  });

  it("prefills web registration from copied invitation links", () => {
    const source = readFileSync("src/app/register/page.tsx", "utf8");

    expect(source).toContain("new URLSearchParams(window.location.search)");
    expect(source).toContain("get(\"email\")");
    expect(source).toContain("setEmail(invitedEmail)");
  });

  it("links the status page from onboarding entry points", () => {
    const users = readFileSync("src/app/(app)/users/page.tsx", "utf8");
    const allowedEmails = readFileSync("src/app/(app)/settings/allowed-emails/page.tsx", "utf8");
    const dialog = readFileSync("src/components/onboarding/OnboardingDialog.tsx", "utf8");

    expect(users).toContain('href="/users/onboarding-status"');
    expect(users).toContain("Onboarding");
    expect(allowedEmails).toContain('href="/users/onboarding-status"');
    expect(allowedEmails).toContain("Status");
    expect(allowedEmails).toContain('name="allowedEmailStatusFilter"');
    expect(allowedEmails).toContain('id="allowed-email-status-filter"');
    expect(allowedEmails).toContain('aria-label="Allowed email status filter"');
    expect(allowedEmails).toContain('className="flex flex-wrap items-center gap-2"');
    expect(dialog).toContain('href="/users/onboarding-status"');
    expect(dialog).toContain("View status");
  });
});
