import { describe, expect, it } from "vitest";
import { defaultShiftConfigs } from "@/app/(app)/settings/sports/types";

describe("new sport staffing defaults", () => {
  it("starts empty instead of silently generating one Student slot per area", () => {
    const defaults = defaultShiftConfigs();
    expect(defaults).toHaveLength(5);
    expect(defaults.every((row) =>
      row.homeStaffCount === 0
      && row.homeStudentCount === 0
      && row.awayStaffCount === 0
      && row.awayStudentCount === 0
      && row.homeCount === 0
      && row.awayCount === 0
    )).toBe(true);
  });
});
