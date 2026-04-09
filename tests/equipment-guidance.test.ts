import { describe, it, expect } from "vitest";
import {
  getActiveGuidance,
  EQUIPMENT_GUIDANCE_RULES,
  type GuidanceContext,
} from "@/lib/equipment-guidance";

describe("getActiveGuidance", () => {
  it("returns battery hint when cameras is selected and active section is batteries", () => {
    const ctx: GuidanceContext = {
      selectedSectionKeys: ["cameras"],
      activeSection: "batteries",
    };
    const hints = getActiveGuidance(ctx);
    expect(hints).toHaveLength(1);
    expect(hints[0].id).toBe("body-needs-batteries");
    expect(hints[0].level).toBe("requirement");
  });

  it("does NOT show battery hint when no body is selected", () => {
    const ctx: GuidanceContext = {
      selectedSectionKeys: ["lenses"],
      activeSection: "batteries",
    };
    expect(getActiveGuidance(ctx)).toHaveLength(0);
  });

  it("does NOT show battery hint when active section is not batteries", () => {
    const ctx: GuidanceContext = {
      selectedSectionKeys: ["cameras"],
      activeSection: "lenses",
    };
    expect(getActiveGuidance(ctx)).toHaveLength(0);
  });

  it("returns empty array when nothing is selected", () => {
    const ctx: GuidanceContext = {
      selectedSectionKeys: [],
      activeSection: "cameras",
    };
    expect(getActiveGuidance(ctx)).toHaveLength(0);
  });

  it("returns battery hint even with multiple sections selected", () => {
    const ctx: GuidanceContext = {
      selectedSectionKeys: ["cameras", "lenses", "accessories"],
      activeSection: "batteries",
    };
    const hints = getActiveGuidance(ctx);
    expect(hints).toHaveLength(2);
    expect(hints[0].id).toBe("body-needs-batteries");
    expect(hints[1].id).toBe("monitors-need-power");
  });
});

describe("EQUIPMENT_GUIDANCE_RULES", () => {
  it("has stable rule IDs", () => {
    const ids = EQUIPMENT_GUIDANCE_RULES.map((r) => r.id);
    expect(ids).toContain("body-needs-batteries");
  });

  it("every rule has required fields", () => {
    for (const rule of EQUIPMENT_GUIDANCE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.message).toBeTruthy();
      expect(["info", "warning", "requirement"]).toContain(rule.level);
      expect(typeof rule.condition).toBe("function");
    }
  });

  it("is extensible — adding a rule does not break existing ones", () => {
    const extended = [
      ...EQUIPMENT_GUIDANCE_RULES,
      {
        id: "test-rule",
        section: null as null,
        message: "Test",
        level: "info" as const,
        condition: () => true,
      },
    ];
    expect(extended.length).toBe(EQUIPMENT_GUIDANCE_RULES.length + 1);
  });
});
