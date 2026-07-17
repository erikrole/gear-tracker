import { describe, expect, it } from "vitest";
import {
  anticipatedGraduationOptions,
  anticipatedGraduationValue,
  formatAnticipatedGraduation,
  parseAnticipatedGraduation,
} from "@/lib/student-profile";

describe("student profile options", () => {
  it("builds term and year choices for the configured range", () => {
    const options = anticipatedGraduationOptions(2027);

    expect(options[0]).toEqual({
      value: "SPRING:2027",
      label: "Spring 2027",
      term: "SPRING",
      year: 2027,
    });
    expect(options).toContainEqual(expect.objectContaining({
      value: "WINTER:2027",
      label: "Winter 2027",
    }));
    expect(options).toHaveLength(36);
  });

  it("round-trips anticipated graduation values", () => {
    const value = anticipatedGraduationValue("SPRING", 2027);

    expect(parseAnticipatedGraduation(value)).toEqual({ term: "SPRING", year: 2027 });
    expect(formatAnticipatedGraduation("SPRING", 2027)).toBe("Spring 2027");
    expect(parseAnticipatedGraduation("UNKNOWN:2027")).toBeNull();
  });
});
