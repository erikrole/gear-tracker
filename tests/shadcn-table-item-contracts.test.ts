import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function src(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

describe("shadcn table contracts", () => {
  // --- Plan 024: audit log table ---

  it("audit log table uses shadcn Table components", () => {
    const auditPage = src("src/app/(app)/settings/audit/page.tsx");

    expect(auditPage).toContain("@/components/ui/table");
    expect(auditPage).toContain("TableHeader");
    expect(auditPage).toContain("TableBody");
    expect(auditPage).toContain("TableHead");
    expect(auditPage).toContain("TableRow");
    expect(auditPage).toContain("TableCell");

    expect(auditPage).not.toContain("<table");
    expect(auditPage).not.toContain("<thead");
    expect(auditPage).not.toContain("<tbody");
    expect(auditPage).not.toContain("<tr");
    expect(auditPage).not.toContain("<td");
    expect(auditPage).not.toContain("<th");
  });

  // --- Plan 025: sports shift-count matrix ---

  it("sports ShiftConfigTable uses shadcn Table primitives for the minimum-crew matrix", () => {
    const shiftConfig = src("src/app/(app)/settings/sports/ShiftConfigTable.tsx");

    expect(shiftConfig).toContain(`from "@/components/ui/table"`);
    expect(shiftConfig).toContain("TableHeader");
    expect(shiftConfig).toContain("TableBody");
    expect(shiftConfig).toContain("TableHead");
    expect(shiftConfig).toContain("TableRow");
    expect(shiftConfig).toContain("TableCell");

    expect(shiftConfig).not.toContain("<table");
    expect(shiftConfig).not.toContain("<thead");
    expect(shiftConfig).not.toContain("<tbody");
    expect(shiftConfig).not.toContain("<tr");
    expect(shiftConfig).not.toContain("<td");
    expect(shiftConfig).not.toContain("<th");

    expect(shiftConfig).toContain(`coverageInputName(primaryCode, area, "homeStaffCount")`);
    expect(shiftConfig).toContain(`coverageInputName(primaryCode, area, "awayStudentCount")`);
  });
});
