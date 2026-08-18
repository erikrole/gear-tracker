import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event crew setup recovery", () => {
  it("keeps setup on Schedule and points an unconfigured detail page back there", () => {
    const page = readFileSync("src/app/(app)/events/[id]/page.tsx", "utf8");
    const schedule = readFileSync("src/app/(app)/schedule/page.tsx", "utf8");
    const list = readFileSync("src/app/(app)/schedule/_components/ListView.tsx", "utf8");

    expect(schedule).toContain("/api/shift-groups");
    expect(list).toContain("Set up crew");
    expect(list).toContain("Use Home defaults");
    expect(list).toContain("Use Away defaults");
    expect(list).toContain("Start empty");
    expect(list).toContain("Manage crew");
    expect(page).not.toContain("Choose a crew template");
    expect(page).toContain("Use the Schedule event menu to choose a crew template.");
    expect(page).toContain('href="/schedule"');
  });

  it("keeps the shift-group request additive for older clients", () => {
    const route = readFileSync("src/app/api/shift-groups/route.ts", "utf8");

    expect(route).toContain('requestedTemplate === undefined ? "EMPTY"');
    expect(route).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(route).toContain("createAuditEntryTx(tx");
    expect(route).toContain("templateManaged: true");
  });
});
