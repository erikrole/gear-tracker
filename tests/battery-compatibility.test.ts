import { describe, expect, it } from "vitest";
import { getBatteryAvailabilityAlerts } from "@/lib/battery-compatibility";

describe("getBatteryAvailabilityAlerts", () => {
  it("warns when selected camera model has fewer compatible batteries than threshold", () => {
    const alerts = getBatteryAvailabilityAlerts({
      selectedAssets: [
        { brand: "Sony", model: "FX3", type: "Camera Body", categoryName: "Cameras" },
      ],
      bulkSkus: [
        {
          id: "sony-battery",
          name: "Sony Battery",
          category: "Batteries",
          availableQuantity: 7,
          minThreshold: 4,
        },
      ],
    });

    expect(alerts).toEqual([
      expect.objectContaining({
        ruleId: "sony-np-fz100",
        availableQuantity: 7,
        threshold: 10,
        batterySkuIds: ["sony-battery"],
      }),
    ]);
  });

  it("does not warn when compatible available quantity meets threshold", () => {
    const alerts = getBatteryAvailabilityAlerts({
      selectedAssets: [
        { brand: "Sony", model: "FX3", type: "Camera Body", categoryName: "Cameras" },
      ],
      bulkSkus: [
        {
          id: "sony-battery",
          name: "Sony Battery",
          category: "Batteries",
          availableQuantity: 12,
        },
      ],
    });

    expect(alerts).toEqual([]);
  });

  it("uses a higher SKU threshold when configured", () => {
    const alerts = getBatteryAvailabilityAlerts({
      selectedAssets: [
        { brand: "Canon", model: "C70", type: "Cinema Camera", categoryName: "Cameras" },
      ],
      bulkSkus: [
        {
          id: "canon-battery",
          name: "Canon LP-E6",
          category: "Batteries",
          availableQuantity: 12,
          minThreshold: 15,
        },
      ],
    });

    expect(alerts[0]).toEqual(expect.objectContaining({
      ruleId: "canon-lp-e6",
      threshold: 15,
      availableQuantity: 12,
    }));
  });

  it("maps imported Sony FX6 camera models to BP-U batteries", () => {
    const alerts = getBatteryAvailabilityAlerts({
      selectedAssets: [
        { brand: "Sony", model: "ILME-FX6V", type: "Cameras/Bodies", categoryName: "Cameras" },
      ],
      bulkSkus: [
        {
          id: "sony-bp-u35",
          name: "Sony BP-U35 Battery",
          category: "Batteries",
          availableQuantity: 4,
        },
        {
          id: "sony-bp-u70",
          name: "Sony BP-U70 Battery",
          category: "Batteries",
          availableQuantity: 3,
        },
      ],
    });

    expect(alerts[0]).toEqual(expect.objectContaining({
      ruleId: "sony-bp-u",
      batterySkuIds: ["sony-bp-u35", "sony-bp-u70"],
      availableQuantity: 7,
      threshold: 10,
    }));
  });
});
