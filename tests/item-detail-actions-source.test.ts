import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HEADER_SOURCE = "src/app/(app)/items/[id]/_components/ItemHeader.tsx";

describe("item detail header booking actions", () => {
  it("gates new reservations on the AVAILABLE derived status", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    // Reserve only starts when current status is AVAILABLE, matching
    // server-side booking validation in availability.ts.
    expect(source).toContain('const isAvailable = asset.computedStatus === "AVAILABLE"');
    expect(source).toContain("const canReserve = asset.availableForReservation && isAvailable");
    expect(source).not.toContain("const canCheckOut");
  });

  it("keeps Reserve as the only item-level newFor flow", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).toContain("/reservations?newFor=${asset.id}");
    expect(source).not.toContain("/checkouts?newFor=${asset.id}");
    expect(source).not.toContain(">Check out<");
  });

  it("names the maintenance and retired blockers in disabled reserve copy", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).toContain("Maintenance items cannot be reserved");
    expect(source).toContain("Retired items cannot be reserved");
    expect(source).toContain("title={reserveDisabledTitle}");
  });

  it("does not keep disabled check out copy in the item header", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).not.toContain("Maintenance items cannot be checked out");
    expect(source).not.toContain("Retired items cannot be checked out");
    expect(source).not.toContain("title={checkOutDisabledTitle}");
  });
});
