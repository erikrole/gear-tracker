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
    expect(table).toContain('code.status === "CLAIMED" && "bg-blue');
    expect(table).not.toContain('code.status === "CLAIMED" && "bg-red');
  });
});
