import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event crew setup recovery", () => {
  it("asks Neutral and Non-game events which saved crew template to use", () => {
    const page = readFileSync("src/app/(app)/events/[id]/page.tsx", "utf8");

    expect(page).toContain("Choose a crew template");
    expect(page).toContain("Use Home defaults");
    expect(page).toContain("Use Away defaults");
    expect(page).toContain("Start empty");
    expect(page).toContain('event.isHome ? "HOME" : "AWAY"');
  });

  it("keeps the shift-group request additive for older clients", () => {
    const route = readFileSync("src/app/api/shift-groups/route.ts", "utf8");

    expect(route).toContain('requestedTemplate === undefined ? "EMPTY"');
    expect(route).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(route).toContain("createAuditEntryTx(tx");
    expect(route).toContain("templateManaged: true");
  });
});
