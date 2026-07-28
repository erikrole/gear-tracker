import { describe, expect, it } from "vitest";
import { buildDynamicTargetWhere, describeDynamicTarget } from "@/lib/services/blast-targeting";

describe("buildDynamicTargetWhere", () => {
  it("returns an empty clause when nothing is selected", () => {
    // Callers must reject this before it reaches the database -- an empty spec
    // would otherwise silently mean "everyone".
    expect(buildDynamicTargetWhere({})).toEqual({});
  });

  it("matches an area against both primaryArea and StudentAreaAssignment", () => {
    // Staff carry primaryArea, students carry area assignments. Testing only one
    // silently drops half the roster.
    const where = buildDynamicTargetWhere({ areas: ["VIDEO"] });
    expect(where.AND).toEqual([
      {
        OR: [
          { primaryArea: { in: ["VIDEO"] } },
          { areaAssignments: { some: { area: { in: ["VIDEO"] } } } },
        ],
      },
    ]);
  });

  it("ORs within a dimension", () => {
    const where = buildDynamicTargetWhere({ areas: ["VIDEO", "PHOTO"] });
    const [clause] = where.AND as Record<string, unknown>[];
    expect(clause?.OR).toEqual([
      { primaryArea: { in: ["VIDEO", "PHOTO"] } },
      { areaAssignments: { some: { area: { in: ["VIDEO", "PHOTO"] } } } },
    ]);
  });

  it("ANDs across dimensions", () => {
    const where = buildDynamicTargetWhere({
      areas: ["VIDEO"],
      workerTypes: ["ST"],
      sportCodes: ["FB"],
    });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses).toHaveLength(3);
    expect(clauses[1]).toEqual({ staffingType: { in: ["ST"] } });
    expect(clauses[2]).toEqual({ sportAssignments: { some: { sportCode: { in: ["FB"] } } } });
  });

  it("omits dimensions that are absent or empty", () => {
    const where = buildDynamicTargetWhere({ areas: [], workerTypes: ["FT"], sportCodes: undefined });
    expect(where.AND).toEqual([{ staffingType: { in: ["FT"] } }]);
  });
});

describe("describeDynamicTarget", () => {
  it("is empty for an empty spec, so callers can reject it", () => {
    expect(describeDynamicTarget({})).toBe("");
  });

  it("renders worker types as the human labels used everywhere else", () => {
    expect(describeDynamicTarget({ workerTypes: ["FT", "ST"] })).toBe("Staff + Student");
  });

  it("joins dimensions for the frozen target summary", () => {
    expect(
      describeDynamicTarget({ areas: ["VIDEO", "LIVE_PRODUCTION"], workerTypes: ["ST"], sportCodes: ["FB", "MBB"] }),
    ).toBe("Video + Live Production · Student · FB, MBB");
  });
});
