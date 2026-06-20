import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("schedule staff/student display source contracts", () => {
  it("uses assigned user scheduling-class labels for filled schedule rows", () => {
    const listView = source("src/app/(app)/schedule/_components/ListView.tsx");
    const eventCrew = source("src/app/(app)/events/[id]/_components/ShiftCoverageCard.tsx");
    const slotCard = source("src/components/shift-detail/ShiftSlotCard.tsx");
    const picker = source("src/components/shift-detail/UserAvatarPicker.tsx");

    expect(listView).toContain("const assignedClassLabel = user ? shiftWorkerLabelForProfile(user) : null");
    expect(listView).toContain("const assignedClassDiffersFromSlot");
    expect(slotCard).toContain("activeAssignment");
    expect(slotCard).toContain("shiftWorkerLabelForProfile(activeAssignment.user)");
    expect(slotCard).toContain("shiftWorkerSlotLabel(workerType)");
    expect(eventCrew).toContain("shiftWorkerLabelForProfile(activeAssignment.user)");
    expect(eventCrew).toContain("const rowClassLabel = activeAssignment");
    expect(eventCrew).toContain("<TableHead>Person</TableHead>");
    expect(picker).toContain("shiftWorkerTypeForProfile(u)");
    expect(picker).toContain("shiftWorkerLabelForProfile(u)");
    expect(picker).toContain("Will use ${shiftWorkerSlotLabel(candidateWorkerType).toLowerCase()}");
    expect(picker).toContain("leave ${shiftWorkerSlotLabel(slotWorkerType).toLowerCase()} open");
  });

  it("keeps open-coverage needs copy neutral instead of class-specific", () => {
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
    expect(assignmentCell).toContain("const openSlotSummary = (() => {");
    expect(assignmentCell).toContain("shiftWorkerSlotLabel(openShifts[0]!.workerType)");
    expect(assignmentCell).toContain('aria-label={openSlotSummary ? `Assign ${openSlotSummary}` : "Assign open slot"}');
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

  it("shows one editable call time for each filled schedule row", () => {
    const listView = source("src/app/(app)/schedule/_components/ListView.tsx");
    const assignmentCell = source("src/app/(app)/schedule/assign/_components/AssignmentCell.tsx");
    const slotCard = source("src/components/shift-detail/ShiftSlotCard.tsx");

    expect(listView).toContain("const callEditorTarget = activeAssignment");
    expect(listView).toContain('target={callEditorTarget}');
    expect(listView).toContain("commonCallWindow(entry)");
    expect(listView).toContain("Most rows");
    expect(listView).toContain("!callMatchesCommon");
    expect(listView).toContain("Crew");
    expect(listView).not.toContain("shiftCallSummary");
    expect(listView).not.toContain("mobileCallSummary");
    expect(listView).not.toContain("Assignment detail");
    expect(listView).not.toContain('target={{ type: "slot", id: shift.id }}');
    expect(listView).not.toContain('target={{ type: "assignment", id: activeAssignment.id }}');

    expect(assignmentCell).toContain('target={{ type: "assignment", id: assignment.id }}');
    expect(assignmentCell).toContain('target={{ type: "slot", id: firstOpenShift.id }}');
    expect(assignmentCell).not.toContain('target={{ type: "slot", id: shift.id }}');

    expect(slotCard).toContain("const showSlotWindow = !isAssigned");
    expect(slotCard).toContain('target={isStaff ? { type: "assignment", id: activeAssignment.id } : undefined}');
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
