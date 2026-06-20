import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("schedule staff/student display source contracts", () => {
  it("uses assigned user role labels for filled schedule rows", () => {
    const listView = source("src/app/(app)/schedule/_components/ListView.tsx");
    const slotCard = source("src/components/shift-detail/ShiftSlotCard.tsx");
    const picker = source("src/components/shift-detail/UserAvatarPicker.tsx");

    expect(listView).toContain("const assignedRoleLabel = user ? shiftWorkerLabelForRole(user.role) : null");
    expect(listView).toContain("const rowRoleLabel = assignedRoleLabel ?? slotLabel");
    expect(slotCard).toContain("activeAssignment");
    expect(slotCard).toContain("shiftWorkerLabelForRole(activeAssignment.user.role)");
    expect(slotCard).toContain("shiftWorkerSlotLabel(workerType)");
    expect(picker).toContain("Will use ${shiftWorkerSlotLabel(candidateWorkerType).toLowerCase()}");
    expect(picker).toContain("leave ${shiftWorkerSlotLabel(slotWorkerType).toLowerCase()} open");
  });

  it("keeps open-coverage needs copy neutral instead of role-specific", () => {
    const listView = source("src/app/(app)/schedule/_components/ListView.tsx");
    const readiness = source("src/app/(app)/schedule/_components/ScheduleReadiness.tsx");
    const assignmentCell = source("src/app/(app)/schedule/assign/_components/AssignmentCell.tsx");
    const filters = source("src/app/(app)/schedule/_components/ScheduleFilters.tsx");

    expect(listView).toContain('const openNeedLabel = `${openSlots.length} ${openSlots.length === 1 ? "person" : "people"}`');
    expect(listView).not.toContain("Student${students");
    expect(readiness).toContain('label: "Crew needed"');
    expect(readiness).toContain("events need crew");
    expect(readiness).not.toContain('label: "Staff needed"');
    expect(filters).toContain("Needs crew");
    expect(filters).not.toContain("Needs staff");
    expect(assignmentCell).toContain('"Assign open slot"');
    expect(assignmentCell).not.toContain("`Assign ${shiftWorkerLabel(firstOpenShift.workerType)}`");
  });

  it("surfaces assignment reroute outcomes in staff assignment toasts", () => {
    const listView = source("src/app/(app)/schedule/_components/ListView.tsx");
    const assignmentCell = source("src/app/(app)/schedule/assign/_components/AssignmentCell.tsx");
    const shiftDetail = source("src/components/ShiftDetailPanel.tsx");
    const route = source("src/app/api/shift-assignments/route.ts");

    expect(route).toContain("roleSlotOutcome");
    expect(listView).toContain("formatRoleSlotAssignmentOutcome(json?.meta?.roleSlotOutcome");
    expect(assignmentCell).toContain("formatRoleSlotAssignmentOutcome(json?.meta?.roleSlotOutcome");
    expect(shiftDetail).toContain("formatRoleSlotAssignmentOutcome(json?.meta?.roleSlotOutcome");
  });

  it("keeps historical role-slot repair permissioned and audited", () => {
    const route = source("src/app/api/shift-assignments/[id]/repair-role-slot/route.ts");
    const service = source("src/lib/services/shift-assignments.ts");

    expect(route).toContain('requirePermission(user.role, "shift_assignment", "assign")');
    expect(route).toContain("repairRoleSlotMismatch(params.id)");
    expect(route).toContain("createAuditEntry");
    expect(route).toContain("shift_assignment_role_slot_repaired");
    expect(service).toContain("export async function repairRoleSlotMismatch");
    expect(service).toContain("data: { shiftId: targetShift.id }");
  });
});
