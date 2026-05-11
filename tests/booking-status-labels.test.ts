import { describe, expect, it } from "vitest";
import { statusBadgeVariant, statusLabel } from "@/components/booking-details/helpers";
import { getStatusVisual } from "@/components/booking-list/types";

describe("booking status labels", () => {
  it("renders pending pickup as a first-class checkout state", () => {
    expect(statusLabel("PENDING_PICKUP", "CHECKOUT")).toBe("Pending Pickup");
    expect(statusBadgeVariant("PENDING_PICKUP", "CHECKOUT")).toBe("orange");
    expect(getStatusVisual("PENDING_PICKUP", false, "CHECKOUT")).toMatchObject({
      dot: "var(--orange)",
      label: "Pending Pickup",
    });
  });

  it("keeps terminal and overdue labels separate", () => {
    expect(statusLabel("CANCELLED", "CHECKOUT")).toBe("Cancelled");
    expect(statusLabel("COMPLETED", "RESERVATION")).toBe("Completed");
    expect(getStatusVisual("OPEN", true, "CHECKOUT")).toMatchObject({
      dot: "var(--red)",
      label: "Overdue",
    });
  });
});
