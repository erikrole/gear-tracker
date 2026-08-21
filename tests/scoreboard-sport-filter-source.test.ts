import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tab = readFileSync("src/app/(app)/users/[id]/UserScoreboardTab.tsx", "utf8");
const service = readFileSync("src/lib/services/scoreboard.ts", "utf8");

describe("profile Scoreboard sport filter", () => {
  it("holds its options from an unfiltered read", () => {
    // The route narrows its own breakdowns, so a filtered response only carries
    // the sports that survived the filter.
    expect(service).toContain("if (filters.sportCode) where.sportCode = filters.sportCode;");

    expect(tab).toContain("const [sportOptions, setSportOptions] = useState<SportOption[]>([]);");
    expect(tab).toContain("const isUnfiltered = resultFilter === \"all\" && sportFilter === \"all\";");
    // Only a settled, unfiltered response may replace the held list.
    expect(tab).toContain("if (!data || !isUnfiltered || loading || refreshing) return;");
    // The dropdown must never be built from whatever the current response holds.
    expect(tab).not.toContain("data.bySport.filter((bucket) => bucket.key !== null)");
  });

  it("names a selected sport the option list does not carry", () => {
    expect(tab).toContain("const selectedIsListed = sportFilter === \"all\"");
    expect(tab).toContain("[...listedSports, { key: sportFilter, label: sportFilter }]");
  });

  it("hides the control instead of offering an empty filter", () => {
    expect(tab).toContain("{sportChoices.length > 0 ? (");
  });
});
