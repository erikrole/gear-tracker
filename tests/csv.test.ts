import { describe, expect, it } from "vitest";
import { csvField } from "@/lib/csv";

describe("csvField", () => {
  it("quotes commas, quotes, and newlines", () => {
    expect(csvField('hello, "world"\nnext')).toBe('"hello, ""world""\nnext"');
  });

  it("prefixes formula-like values before CSV output", () => {
    expect(csvField("=2+2")).toBe("'=2+2");
    expect(csvField("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(csvField("-10+20")).toBe("'-10+20");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("  =2+2")).toBe("'  =2+2");
  });

  it("returns empty string for nullish values", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
});
