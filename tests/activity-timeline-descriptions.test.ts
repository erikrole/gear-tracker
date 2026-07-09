import { describe, expect, it } from "vitest";
import { describeAction, type AuditEntry } from "@/components/ActivityTimeline";

function entry(
  action: string,
  afterJson: Record<string, unknown> | null = null,
  beforeJson: Record<string, unknown> | null = null,
): AuditEntry {
  return {
    id: "audit-1",
    action,
    entityType: "booking",
    entityId: "booking-1",
    createdAt: "2026-07-09T19:17:00.000Z",
    beforeJson,
    afterJson,
    actor: { id: "user-1", name: "Erik Role" },
  };
}

describe("ActivityTimeline kiosk item descriptions", () => {
  it("names the exact item added at a kiosk", () => {
    expect(
      describeAction(
        entry("kiosk_checkout_item_added", {
          itemName: "FX3 1",
          kioskName: "Video Office Kiosk",
        }),
        "Erik Role",
        "booking",
      ),
    ).toBe("Added FX3 1 at the Video Office Kiosk");
  });

  it("names returned items and falls back safely for historical audit rows", () => {
    expect(
      describeAction(
        entry("kiosk_checkin", {
          itemNames: ["FX3 1", "Sony Battery #7"],
          kioskName: "Video Office Kiosk",
        }),
        "Erik Role",
        "booking",
      ),
    ).toBe("Returned FX3 1 and Sony Battery #7 at the Video Office Kiosk");
    expect(
      describeAction(entry("kiosk_checkin"), "Erik Role", "booking"),
    ).toBe("Returned gear at a kiosk");
  });
});
