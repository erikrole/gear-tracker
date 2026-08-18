import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("licenses UI and privacy contracts", () => {
  it("redacts other holders' profile fields from student license responses", () => {
    const route = source("src/app/api/licenses/route.ts");

    expect(route).toContain("claim.userId === user.id");
    expect(route).toContain("userId: null");
    expect(route).toContain("user: null");
    expect(route).toContain("occupantLabel: null");
  });

  it("keeps renewal controls behind the staff role gate", () => {
    const page = source("src/app/(app)/licenses/page.tsx");

    expect(page).toContain("onRenew={isAdmin ? () => setShowRenew(true) : undefined}");
    expect(page).toContain("{isAdmin && allCodes.length > 0 && (");
    expect(page).toContain("Renew licenses");
  });

  it("shows explicit claim and inspect actions with active-use color semantics", () => {
    const table = source("src/app/(app)/licenses/LicenseTable.tsx");

    expect(table).toMatch(/<Eye[\s\S]*?Inspect/);
    expect(table).toMatch(/<KeyRound[\s\S]*?Claim/);
    expect(table).toContain('code.status === "CLAIMED" && "bg-[var(--blue-bg)]');
    expect(table).not.toContain('code.status === "CLAIMED" && "bg-[var(--red-bg)]');
  });

  it("lets staff assign an open slot to an active user through the managed occupy route", () => {
    const sheet = source("src/app/(app)/licenses/AdminClaimSheet.tsx");
    const route = source("src/app/api/licenses/[id]/occupy/route.ts");
    const service = source("src/lib/services/licenses.ts");

    expect(sheet).toContain("Assign open slot");
    expect(sheet).toContain('body: JSON.stringify({ userId: selectedUserId })');
    expect(route).toContain("body.userId !== undefined");
    expect(route).toContain("assignCodeToUser(params.id, body.userId)");
    expect(route).toContain("assignedUserId: assignment.assignee?.id ?? null");
    expect(service).toContain('role: { in: ["ADMIN", "STAFF", "STUDENT"] }');
    expect(service).toContain("already has an active Photo Mechanic license");
  });

  it("uses the local calendar date for date-only expiry values across the license page", () => {
    const page = source("src/app/(app)/licenses/page.tsx");
    const table = source("src/app/(app)/licenses/LicenseTable.tsx");
    const banner = source("src/app/(app)/licenses/MyLicensePanel.tsx");
    const renew = source("src/app/(app)/licenses/BulkRenewDialog.tsx");
    const sheet = source("src/app/(app)/licenses/AdminClaimSheet.tsx");

    expect(page).toContain("licenseDaysUntilExpiry");
    expect(page).toContain("localDateKey");
    expect(table).toContain("formatLicenseExpiryDate");
    expect(table).toContain("licenseDaysUntilExpiry");
    expect(banner).toContain("isLicenseExpired");
    expect(renew).toContain("licenseDaysUntilExpiry");
    expect(sheet).toContain("licenseExpiryInputValue");
    expect(sheet).toContain("isLicenseExpired");
  });
});
