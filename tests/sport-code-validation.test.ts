import { describe, expect, it } from "vitest";
import {
  nullableSportCodeSchema,
  optionalSportCodeSchema,
  sportCodeSchema,
  upsertSportConfigSchema,
  updateSportConfigGroupSchema,
} from "@/lib/validation";

describe("sport code validation", () => {
  it("normalizes accepted sport codes to canonical uppercase values", () => {
    expect(sportCodeSchema.parse(" vb ")).toBe("VB");
    expect(optionalSportCodeSchema.parse("msoc")).toBe("MSOC");
    expect(nullableSportCodeSchema.parse("fb")).toBe("FB");
  });

  it("treats empty optional and nullable sport-code inputs as absent", () => {
    expect(optionalSportCodeSchema.parse("")).toBeUndefined();
    expect(nullableSportCodeSchema.parse("")).toBeNull();
    expect(nullableSportCodeSchema.parse(undefined)).toBeNull();
  });

  it("rejects unknown sport codes at API schema boundaries", () => {
    expect(() => sportCodeSchema.parse("football")).toThrow("Invalid sport code");
    expect(() => upsertSportConfigSchema.parse({ sportCode: "BAD" })).toThrow("Invalid sport code");
  });

  it("normalizes grouped sport config codes before service writes", () => {
    const parsed = updateSportConfigGroupSchema.parse({
      codes: ["mxc", "wxc"],
      active: true,
    });

    expect(parsed.codes).toEqual(["MXC", "WXC"]);
  });
});
