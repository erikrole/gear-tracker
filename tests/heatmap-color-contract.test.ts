import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const heatmapSource = readFileSync("src/components/ui/heatmap.tsx", "utf8");
const checkoutsSource = readFileSync("src/app/(app)/reports/checkouts/page.tsx", "utf8");

describe("checkout activity heatmap color contract", () => {
  it("uses theme tokens and perceptual interpolation instead of the legacy green RGB scale", () => {
    expect(heatmapSource).toContain("color-mix(in oklch");
    expect(heatmapSource).not.toContain("interpolateRgb");
    expect(heatmapSource).not.toMatch(/#[0-9a-f]{6}/i);

    for (let step = 1; step <= 5; step += 1) {
      expect(heatmapSource).toContain(`var(--heatmap-${step})`);
    }
  });

  it("keeps the checkout report on the continuous activity scale", () => {
    expect(checkoutsSource).toContain('colorMode="interpolate"');
  });
});
