import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schedulePageSource = readFileSync("src/app/(app)/schedule/page.tsx", "utf8");
const routeSource = readFileSync("src/app/api/schedule/export/route.ts", "utf8");
const serviceSource = readFileSync("src/lib/services/schedule-exports.ts", "utf8");

describe("schedule export source contracts", () => {
  it("keeps Schedule exports staff-facing and CSV-only from the Schedule header", () => {
    expect(schedulePageSource).toContain("Schedule CSV");
    expect(schedulePageSource).toContain("/api/schedule/export?");
    expect(schedulePageSource).toContain("Weekly roster");
    expect(schedulePageSource).toContain("Gear readiness");
    expect(routeSource).toContain('requirePermission(user.role, "report", "view")');
    expect(routeSource).toContain('"Content-Type": "text/csv; charset=utf-8"');
  });

  it("uses shared CSV escaping and bounded server-side exports", () => {
    expect(serviceSource).toContain("csvField");
    expect(serviceSource).toContain("SCHEDULE_EXPORT_LIMIT = 5000");
    expect(serviceSource).toContain("SCHEDULE_EXPORT_MAX_DAYS = 366");
  });
});
