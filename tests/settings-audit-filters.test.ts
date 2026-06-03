import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeAuditFilters,
  validateAuditFilters,
} from "@/app/(app)/settings/audit/audit-pagination";

describe("settings audit filter validation", () => {
  it("normalizes text and date filters before applying them", () => {
    expect(normalizeAuditFilters({
      entityType: " Item ",
      action: " update ",
      from: " 2026-06-01 ",
      to: " 2026-06-02 ",
    })).toEqual({
      entityType: "Item",
      action: "update",
      from: "2026-06-01",
      to: "2026-06-02",
    });
  });

  it("rejects invalid and inverted date filters before fetch", () => {
    expect(validateAuditFilters({
      entityType: "",
      action: "",
      from: "2026-02-30",
      to: "",
    }).error).toBe("Enter a valid From date.");

    expect(validateAuditFilters({
      entityType: "",
      action: "",
      from: "",
      to: "not-a-date",
    }).error).toBe("Enter a valid To date.");

    expect(validateAuditFilters({
      entityType: "",
      action: "",
      from: "2026-06-02",
      to: "2026-06-01",
    }).error).toBe("From date must be on or before To date.");
  });

  it("keeps invalid filter feedback inline in the page source", () => {
    const source = readFileSync("src/app/(app)/settings/audit/page.tsx", "utf8");

    expect(source).toContain("validateAuditFilters(draftFilters)");
    expect(source).toContain("setFilterError(result.error)");
    expect(source).toContain("<AlertTitle>Check audit filters</AlertTitle>");
    expect(source).toContain("<AlertDescription>{filterError}</AlertDescription>");
    expect(source).toContain("updateDraftFilter");
  });
});
