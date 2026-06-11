import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("item bookable policy controls", () => {
  it("keeps item detail settings collapsed to one Bookable policy switch", () => {
    const source = readFileSync("src/app/(app)/items/[id]/ItemBookingsTab.tsx", "utf8");

    expect(source).toContain("<CardTitle>Booking access</CardTitle>");
    expect(source).toContain('id="item-bookable"');
    expect(source).toContain('label="Bookable"');
    expect(source).toContain("availableForCheckout: nextBookable");
    expect(source).toContain("availableForReservation: nextBookable");
    expect(source).not.toContain("Workflow Eligibility");
    expect(source).not.toContain("Custody eligible");
  });

  it("keeps Standard Add item to one Bookable policy switch plus attachment policy", () => {
    const source = readFileSync("src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx", "utf8");

    expect(source).toContain('htmlFor="new-item-bookable"');
    expect(source).toContain('name="bookable"');
    expect(source).toContain("availableForReservation: bookable");
    expect(source).toContain("availableForCheckout: bookable");
    expect(source).toContain("availableForCustody: !isAccessory");
    expect(source).not.toContain("new-item-available-for-reservation");
    expect(source).not.toContain("new-item-available-for-checkout");
    expect(source).not.toContain("new-item-available-for-custody");
  });
});
