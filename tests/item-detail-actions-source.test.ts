import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HEADER_SOURCE = "src/app/(app)/items/[id]/_components/ItemHeader.tsx";

describe("item detail header booking actions", () => {
  it("gates new bookings on the AVAILABLE derived status", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    // Reserve and Check out only start when current status is AVAILABLE,
    // matching server-side booking validation in availability.ts.
    expect(source).toContain('const isAvailable = asset.computedStatus === "AVAILABLE"');
    expect(source).toContain("const canReserve = asset.availableForReservation && isAvailable");
    expect(source).toContain("const canCheckOut = asset.availableForCheckout && isAvailable");
  });

  it("keeps the enabled Reserve and Check out links pointing at newFor flows", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).toContain("/reservations?newFor=${asset.id}");
    expect(source).toContain("/checkouts?newFor=${asset.id}");
  });

  it("names the maintenance and retired blockers in disabled reserve copy", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).toContain("Maintenance items cannot be reserved");
    expect(source).toContain("Retired items cannot be reserved");
    expect(source).toContain("title={reserveDisabledTitle}");
  });

  it("names the maintenance and retired blockers in disabled check out copy", () => {
    const source = readFileSync(HEADER_SOURCE, "utf8");

    expect(source).toContain("Maintenance items cannot be checked out");
    expect(source).toContain("Retired items cannot be checked out");
    expect(source).toContain("title={checkOutDisabledTitle}");
  });
});
