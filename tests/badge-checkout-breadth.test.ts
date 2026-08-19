import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  automaticMeasuredRuleKeys,
  checkoutAutomaticRuleCounts,
  type CheckoutBadgeEvidence,
} from "@/lib/badges/automatic-rules";
import { isHiddenUntilEarnedBadge } from "@/lib/badges/display";

const TZ = "America/Chicago";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function category(name: string, parent?: string) {
  return { id: `cat-${parent ?? name}`, name, parent: parent ? { name: parent } : null };
}

function checkout(overrides: {
  startsAt: string;
  kitId?: string | null;
  assets?: Array<{ assetId: string; family: string }>;
  bulk?: Array<{ family: string; quantity: number }>;
}): CheckoutBadgeEvidence {
  return {
    startsAt: new Date(overrides.startsAt),
    kitId: overrides.kitId ?? null,
    serializedItems: (overrides.assets ?? []).map((item) => ({
      assetId: item.assetId,
      asset: { category: category(item.family) },
    })),
    bulkItems: (overrides.bulk ?? []).map((item) => ({
      checkedOutQuantity: item.quantity,
      bulkSku: { categoryRel: category(item.family) },
    })),
  };
}

describe("checkout breadth rule counts", () => {
  it("counts distinct serialized items across every credited checkout", () => {
    const counts = checkoutAutomaticRuleCounts([
      checkout({ startsAt: "2026-08-10T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }, { assetId: "a2", family: "lenses" }] }),
      checkout({ startsAt: "2026-08-20T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }, { assetId: "a3", family: "audio" }] }),
    ], TZ);

    expect(counts.get("checkout_distinct_assets")).toBe(3);
  });

  it("tracks the most-repeated single item, not the total", () => {
    const counts = checkoutAutomaticRuleCounts([
      checkout({ startsAt: "2026-08-10T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }] }),
      checkout({ startsAt: "2026-08-20T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }] }),
      checkout({ startsAt: "2026-08-30T18:00:00.000Z", assets: [{ assetId: "a2", family: "cameras" }] }),
    ], TZ);

    expect(counts.get("checkout_same_asset")).toBe(2);
  });

  it("groups weeks on a Monday anchor in institution time", () => {
    // Sunday 8 p.m. local and the Monday after it are different weeks; the
    // Saturday before shares a week with that Sunday.
    const counts = checkoutAutomaticRuleCounts([
      // Sat 2026-08-08 local.
      checkout({ startsAt: "2026-08-08T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }] }),
      // Sun 2026-08-09 20:00 local, still the same Monday-anchored week.
      checkout({ startsAt: "2026-08-10T01:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }] }),
      // Mon 2026-08-10 local, a new week.
      checkout({ startsAt: "2026-08-10T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }] }),
    ], TZ);

    expect(counts.get("checkout_weeks")).toBe(2);
  });

  it("counts only checkouts built from a saved kit", () => {
    const counts = checkoutAutomaticRuleCounts([
      checkout({ startsAt: "2026-08-10T18:00:00.000Z", kitId: "kit-1", assets: [{ assetId: "a1", family: "cameras" }] }),
      checkout({ startsAt: "2026-08-20T18:00:00.000Z", assets: [{ assetId: "a2", family: "cameras" }] }),
    ], TZ);

    expect(counts.get("checkout_from_kit")).toBe(1);
  });

  it("counts an all-battery run from bulk pieces that were handed out", () => {
    const counts = checkoutAutomaticRuleCounts([
      checkout({ startsAt: "2026-08-10T18:00:00.000Z", bulk: [{ family: "batteries", quantity: 8 }] }),
      // Batteries plus a camera is a normal checkout, not a battery run.
      checkout({ startsAt: "2026-08-20T18:00:00.000Z", assets: [{ assetId: "a1", family: "cameras" }], bulk: [{ family: "batteries", quantity: 4 }] }),
      // Nothing was actually handed out, so there is no run to recognise.
      checkout({ startsAt: "2026-08-30T18:00:00.000Z", bulk: [{ family: "batteries", quantity: 0 }] }),
    ], TZ);

    expect(counts.get("checkout_batteries_only")).toBe(1);
  });

  it("leaves the existing family and breadth rules unchanged", () => {
    const counts = checkoutAutomaticRuleCounts([
      checkout({
        startsAt: "2026-08-10T18:00:00.000Z",
        assets: [
          { assetId: "a1", family: "cameras" },
          { assetId: "a2", family: "lenses" },
          { assetId: "a3", family: "audio" },
        ],
      }),
    ], TZ);

    expect(counts.get("checkout_full_rig")).toBe(1);
    expect(counts.get("category_collector")).toBe(3);
  });

  it("reports zero rather than nothing for someone with no checkouts", () => {
    const counts = checkoutAutomaticRuleCounts([], TZ);

    expect(counts.get("checkout_distinct_assets")).toBe(0);
    expect(counts.get("checkout_weeks")).toBe(0);
    expect(counts.get("checkout_from_kit")).toBe(0);
    expect(counts.get("checkout_same_asset")).toBe(0);
    expect(counts.get("checkout_batteries_only")).toBe(0);
  });

  it("registers every new rule as measured so profile progress can derive it", () => {
    for (const ruleKey of [
      "checkout_distinct_assets",
      "checkout_weeks",
      "checkout_from_kit",
      "checkout_same_asset",
      "checkout_batteries_only",
    ]) {
      expect(automaticMeasuredRuleKeys.has(ruleKey)).toBe(true);
    }
  });
});

describe("checkout breadth catalog", () => {
  const migration = source("prisma/migrations/0118_badge_checkout_breadth/migration.sql");
  const seed = source("prisma/seed.mjs");

  it("seeds five definitions the evaluator can award", () => {
    for (const [key, ruleKey] of [
      ["deep_inventory", "checkout_distinct_assets"],
      ["regular_rotation", "checkout_weeks"],
      ["kit_complete", "checkout_from_kit"],
      ["old_faithful", "checkout_same_asset"],
      ["battery_run", "checkout_batteries_only"],
    ]) {
      expect(migration).toContain(`'${key}'`);
      expect(migration).toContain(`'${ruleKey}'`);
      expect(seed).toContain(`key: "${key}"`);
      expect(seed).toContain(`ruleKey: "${ruleKey}"`);
    }
  });

  it("backfills from credited receipts, not from whoever owns the booking today", () => {
    expect(migration).toContain('r."event_type" = \'checkout_opened\'');
    expect(migration).not.toContain("requester_user_id");
    expect(migration).toContain('i."checked_out_quantity" > 0');
  });

  it("keeps the two surprises out of the locked grid until they are earned", () => {
    expect(isHiddenUntilEarnedBadge("old_faithful")).toBe(true);
    expect(isHiddenUntilEarnedBadge("battery_run")).toBe(true);
    expect(isHiddenUntilEarnedBadge("deep_inventory")).toBe(false);
  });
});

describe("checkout breadth evidence selects", () => {
  const evaluator = source("src/lib/badges/evaluator.ts");
  const queries = source("src/lib/badges/queries.ts");

  it("selects the same new columns for awards and for profile progress", () => {
    for (const field of ["startsAt: true", "kitId: true", "assetId: true"]) {
      expect(evaluator).toContain(field);
      expect(queries).toContain(field);
    }
    expect(evaluator).toContain("checkoutAutomaticRuleCounts(creditedCheckouts, env.appTimezone)");
    expect(queries).toContain("checkoutAutomaticRuleCounts(creditedCheckoutRows, env.appTimezone)");
  });
});
