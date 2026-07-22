import { describe, expect, it } from "vitest";
import { getBadgeRarity, RARITY_PROVING_PERIOD_MS } from "@/lib/badges/display";

const base = {
  key: "some_badge",
  category: "CHECKOUT",
  kind: "COUNT",
  trigger: "checkout:opened",
  threshold: 5,
};

const longAgo = new Date("2020-01-01T00:00:00.000Z");
const now = new Date("2026-07-22T00:00:00.000Z");

describe("badge rarity from scarcity", () => {
  it("rates a badge by how many people actually hold it", () => {
    const rate = (holders: number) =>
      getBadgeRarity({ ...base, holders, eligible: 100, createdAt: longAgo }, now);

    expect(rate(80)).toBe("Common");
    expect(rate(50)).toBe("Common");
    expect(rate(30)).toBe("Uncommon");
    expect(rate(20)).toBe("Uncommon");
    expect(rate(10)).toBe("Rare");
    expect(rate(5)).toBe("Rare");
    expect(rate(2)).toBe("Legendary");
    expect(rate(1)).toBe("Legendary");
  });

  it("does not call an unearned badge Legendary", () => {
    // The guard that matters. Scarcity cannot distinguish "nobody can do this"
    // from "nobody has had the chance yet", so a badge with no holders is rated
    // by difficulty instead -- otherwise every badge added to the catalog would
    // launch as the rarest thing in it.
    expect(
      getBadgeRarity({ ...base, threshold: 5, holders: 0, eligible: 100, createdAt: longAgo }, now),
    ).toBe("Common");
    expect(
      getBadgeRarity({ ...base, threshold: 50, holders: 0, eligible: 100, createdAt: longAgo }, now),
    ).toBe("Rare");
  });

  it("gives a new definition time to be earned before rating it", () => {
    const fresh = new Date(now.getTime() - RARITY_PROVING_PERIOD_MS + 1000);
    const proven = new Date(now.getTime() - RARITY_PROVING_PERIOD_MS - 1000);

    // One holder out of 100 is Legendary by scarcity, but not on day one.
    expect(getBadgeRarity({ ...base, holders: 1, eligible: 100, createdAt: fresh }, now)).toBe("Common");
    expect(getBadgeRarity({ ...base, holders: 1, eligible: 100, createdAt: proven }, now)).toBe("Legendary");
  });

  it("falls back cleanly when the population is unknown", () => {
    expect(getBadgeRarity({ ...base, holders: 5, eligible: 0 }, now)).toBe("Common");
    expect(getBadgeRarity(base, now)).toBe("Common");
  });

  it("corrects the two ratings the hardcoded table had backwards", () => {
    // Live data at the time of the rewrite: 14 users, `zero_errors` held by 10
    // of them and labelled Uncommon, `checkout_25` held by nobody and labelled
    // Common. Scarcity says the opposite of the first and declines to rate the
    // second at all.
    expect(
      getBadgeRarity(
        { key: "zero_errors", category: "SCAN", kind: "RULE", trigger: "scan:rule", threshold: 10, holders: 10, eligible: 14, createdAt: longAgo },
        now,
      ),
    ).toBe("Common");
    expect(
      getBadgeRarity(
        { key: "checkout_25", category: "CHECKOUT", kind: "COUNT", trigger: "checkout:opened", threshold: 25, holders: 0, eligible: 14, createdAt: longAgo },
        now,
      ),
    ).toBe("Uncommon");
  });
});
