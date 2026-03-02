import { describe, expect, it } from "vitest";
import { generateEventTitle, sportLabel } from "../src/lib/sports";

describe("generateEventTitle", () => {
  it("generates home title", () => {
    expect(generateEventTitle("MBB", "Michigan State", true)).toBe("MBB vs Michigan State");
  });

  it("generates away title", () => {
    expect(generateEventTitle("FB", "Ohio State", false)).toBe("FB at Ohio State");
  });

  it("generates neutral title", () => {
    expect(generateEventTitle("WBB", "Iowa", null)).toBe("WBB vs Iowa (Neutral)");
  });

  it("handles missing opponent", () => {
    expect(generateEventTitle("VB", null, true)).toBe("VB vs TBD");
  });
});

describe("sportLabel", () => {
  it("returns label for known code", () => {
    expect(sportLabel("FB")).toBe("Football");
    expect(sportLabel("MBB")).toBe("Men's Basketball");
  });

  it("returns code for unknown code", () => {
    expect(sportLabel("XYZ")).toBe("XYZ");
  });
});
