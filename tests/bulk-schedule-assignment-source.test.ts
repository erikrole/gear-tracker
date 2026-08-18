import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("bulk schedule assignment contracts", () => {
  it("keeps the mutation behind the working-copy and exact-version release boundary", () => {
    const service = read("src/lib/services/bulk-schedule-assignment.ts");
    const applyRoute = read("src/app/api/schedule/bulk-assignment/apply/route.ts");

    expect(service).toContain("scheduleBulkAssignment");
    expect(service).toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable");
    expect(service).toContain('source: "AUTO_FILL"');
    expect(service).toContain("preview.fingerprint !== input.fingerprint");
    expect(service).toContain("enqueueRelease({ shiftGroupId, version: 1, now, batchId })");
    expect(applyRoute).toContain('requirePermission(user.role, "shift", "manage")');
    expect(applyRoute).toContain("bulkAssignmentApplySchema");
  });

  it("consolidates worker notifications and gives them a My Shifts deep link", () => {
    const notifications = read("src/lib/services/notifications.ts");
    const policy = read("src/lib/services/schedule-notification-policy.ts");
    const workflow = read("src/workflows/pending-schedule-release.ts");

    expect(notifications).toContain('type: "shift_schedule_bulk_assigned"');
    expect(notifications).toContain('const body = "Click to review your upcoming shifts"');
    expect(notifications).toContain("scheduleMyShiftsNotificationPayload");
    expect(notifications).toContain("schedule_bulk_assignment:${batch.id}:${userId}");
    expect(policy).toContain('target: "schedule"');
    expect(policy).toContain('myShifts: "true"');
    expect(policy).toContain("startDate");
    expect(policy).toContain("endDate");
    expect(workflow).toContain('status: "RELEASED"');
    expect(workflow).toContain("recordBulkScheduleReleaseOutcome");
    expect(workflow).toContain("notifyPublishedShiftGroupWorkers");
    expect(workflow.indexOf('if (batchId)')).toBeLessThan(workflow.indexOf("notifyPublishedShiftGroupWorkers(shiftGroupId"));
  });

  it("keeps the UI preview-first and supports the recipient filter deep link", () => {
    const dialog = read("src/app/(app)/schedule/assign/_components/BulkAssignmentDialog.tsx");
    const assignPage = read("src/app/(app)/schedule/assign/_components/AssignPageClient.tsx");
    const scheduleHook = read("src/hooks/use-schedule-data.ts");

    expect(dialog).toContain("Nothing changes until you apply");
    expect(dialog).toContain("/api/schedule/bulk-assignment/preview");
    expect(dialog).toContain("/api/schedule/bulk-assignment/apply");
    expect(assignPage).toContain("BulkAssignmentDialog");
    expect(scheduleHook).toContain('query.get("myShifts") === "true"');
    expect(scheduleHook).toContain('query.get("startDate")');
    expect(scheduleHook).toContain('query.get("endDate")');
    expect(scheduleHook).toContain("dateRange");
  });
});
