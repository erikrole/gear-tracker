import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canSelectSerializedAssetForWindow } from "@/components/equipment-picker/serialized-selection";

const equipmentPickerSource = readFileSync(
  join(process.cwd(), "src/components/EquipmentPicker.tsx"),
  "utf8",
);

describe("canSelectSerializedAssetForWindow", () => {
  it("allows currently held assets when they are due back at least 60 minutes before the requested reservation starts", () => {
    expect(canSelectSerializedAssetForWindow(
      {
        computedStatus: "CHECKED_OUT",
        currentHolder: {
          bookingId: "booking-1",
          bookingTitle: "Current checkout",
          holderName: "Jacob Phillips",
          endsAt: "2026-06-29T14:00:00.000Z",
        },
      },
      { startsAt: "2026-06-29T15:00:00.000Z" },
    )).toBe(true);
  });

  it("blocks currently held assets when the holder return is inside the 60-minute turnaround buffer", () => {
    expect(canSelectSerializedAssetForWindow(
      {
        computedStatus: "CHECKED_OUT",
        currentHolder: {
          bookingId: "booking-1",
          bookingTitle: "Current checkout",
          holderName: "Jacob Phillips",
          endsAt: "2026-06-29T14:30:00.000Z",
        },
      },
      { startsAt: "2026-06-29T15:00:00.000Z" },
    )).toBe(false);
  });

  it("keeps terminal item states blocked even when a future window exists", () => {
    expect(canSelectSerializedAssetForWindow(
      {
        computedStatus: "MAINTENANCE",
        currentHolder: null,
      },
      { startsAt: "2026-06-29T15:00:00.000Z" },
    )).toBe(false);
  });

  it("keeps explicit availability conflicts blocked", () => {
    expect(canSelectSerializedAssetForWindow(
      {
        computedStatus: "CHECKED_OUT",
        currentHolder: {
          bookingId: "booking-1",
          bookingTitle: "Current checkout",
          holderName: "Jacob Phillips",
          endsAt: "2026-06-27T17:00:00.000Z",
        },
      },
      {
        startsAt: "2026-06-29T15:00:00.000Z",
        conflict: {
          assetId: "asset-1",
          conflictingBookingTitle: "Overlap",
          startsAt: "2026-06-29T14:00:00.000Z",
          endsAt: "2026-06-29T18:00:00.000Z",
        },
      },
    )).toBe(false);
  });
});

describe("EquipmentPicker serialized availability contract", () => {
  it("uses the window-aware selection helper for row toggles and scan-to-add", () => {
    expect(equipmentPickerSource).toContain("import { canSelectSerializedAssetForWindow }");
    expect(equipmentPickerSource).toContain("const canSelect = canSelectSerializedAssetForWindow(asset, { startsAt, conflict });");
    expect(equipmentPickerSource).toContain("if (!canSelectSerializedAssetForWindow(asset, { startsAt, conflict: scanConflict }))");
    expect(equipmentPickerSource).not.toContain('if (asset.computedStatus !== "AVAILABLE")');
  });
});
