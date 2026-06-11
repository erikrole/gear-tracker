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

  // --- Plan 026: schedule assignment grid ---

  it("assignment grid uses shadcn Table components and preserves sticky column", () => {
    const grid = src("src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx");
    const cell = src("src/app/(app)/schedule/assign/_components/AssignmentCell.tsx");

    expect(grid).toContain(`from "@/components/ui/table"`);
    expect(grid).toContain("TableHeader");
    expect(grid).toContain("TableBody");
    expect(grid).toContain("TableHead");
    expect(grid).toContain("TableRow");
    expect(grid).toContain("TableCell");

    expect(cell).toContain("TableCell");

    expect(grid).not.toContain("<table");
    expect(grid).not.toContain("<thead");
    expect(grid).not.toContain("<tbody");
    expect(grid).not.toContain("<tr");
    expect(grid).not.toContain("<td");
    expect(grid).not.toContain("<th");

    expect(cell).not.toContain("<td");

    expect(grid).toContain("sticky left-0");
    expect(grid).toContain("min-w-[760px]");
    expect(cell).toContain("group/cell");
  });

  // --- Plan 027: dashboard queue rows ---

  it("dashboard queue rows use shadcn Item primitives and preserve domain hooks", () => {
    const bookingRow = src("src/app/(app)/dashboard/booking-row.tsx");
    const myGear = src("src/app/(app)/dashboard/my-gear-column.tsx");
    const teamActivity = src("src/app/(app)/dashboard/team-activity-column.tsx");

    expect(bookingRow).toContain(`from "@/components/ui/item"`);
    expect(bookingRow).toContain("ItemContent");
    expect(bookingRow).toContain("ItemTitle");
    expect(bookingRow).toContain("ItemDescription");
    expect(bookingRow).toContain("ItemActions");

    expect(myGear).toContain(`from "@/components/ui/item"`);
    expect(myGear).toContain("ItemGroup");

    expect(teamActivity).toContain(`from "@/components/ui/item"`);
    expect(teamActivity).toContain("ItemGroup");

    expect(bookingRow).toContain("GearAvatarStack");
    expect(bookingRow).toContain("onSelectBooking");
    expect(myGear).toContain("onCreateBooking");
    expect(teamActivity).toContain("eventCoverageBadge");
  });
});
