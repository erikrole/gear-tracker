import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { statusBadgeVariant, statusLabel } from "@/components/booking-details/helpers";
import { getStatusVisual } from "@/components/booking-list/types";
import { bookingStatusDisplay, bookingStatusLabel, bookingStatusVisual } from "@/lib/booking-status-display";

describe("booking status labels", () => {
  it("renders pending pickup as a first-class checkout state", () => {
    expect(bookingStatusLabel("PENDING_PICKUP", "CHECKOUT")).toBe("Awaiting Pickup");
    expect(statusLabel("PENDING_PICKUP", "CHECKOUT")).toBe("Awaiting Pickup");
    expect(statusBadgeVariant("PENDING_PICKUP", "CHECKOUT")).toBe("orange");
    expect(getStatusVisual("PENDING_PICKUP", false, "CHECKOUT")).toMatchObject({
      dot: "var(--orange)",
      label: "Awaiting Pickup",
    });
  });

  it("keeps terminal and overdue labels separate", () => {
    expect(statusLabel("CANCELLED", "CHECKOUT")).toBe("Cancelled");
    expect(statusLabel("COMPLETED", "RESERVATION")).toBe("Completed");
    expect(bookingStatusDisplay("BOOKED", "RESERVATION")).toEqual({
      label: "Confirmed",
      variant: "purple",
    });
    expect(getStatusVisual("OPEN", true, "CHECKOUT")).toMatchObject({
      dot: "var(--red)",
      label: "Overdue",
    });
  });

  it("keeps booking detail and list visuals on the shared display helper", () => {
    expect(statusLabel("OPEN", "CHECKOUT")).toBe(bookingStatusLabel("OPEN", "CHECKOUT"));
    expect(statusBadgeVariant("BOOKED", "RESERVATION")).toBe(bookingStatusDisplay("BOOKED", "RESERVATION").variant);
    expect(getStatusVisual("OPEN", false, "CHECKOUT")).toMatchObject(bookingStatusVisual("OPEN", { kind: "CHECKOUT" }));
  });

  it("keeps item booking history from reintroducing local booking status labels", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/items/[id]/ItemBookingsTab.tsx"), "utf8");

    expect(source).toContain("bookingStatusDisplay");
    expect(source).not.toContain("function bookingStatusLabel");
    expect(source).not.toMatch(/case\s+"(?:CHECKED_OUT|RETURNED|CONVERTED|CLOSED)"/);
  });
});
