import type { Role, ShiftWorkerType } from "@prisma/client";

export type ShiftWorkerKind = ShiftWorkerType;
export type ShiftUserRoleKind = Role | string | null | undefined;
export type RoleSlotOutcomeLike = {
  originalWorkerType?: ShiftWorkerType | string | null;
  assignedWorkerType?: ShiftWorkerType | string | null;
  movedToMatchingSlot?: boolean;
  createdMatchingSlot?: boolean;
  reusedMatchingSlot?: boolean;
} | null | undefined;

export function shiftWorkerLabel(workerType: ShiftWorkerType | string | null | undefined): "Staff" | "Student" {
  return workerType === "FT" ? "Staff" : "Student";
}

export function shiftWorkerSlotLabel(workerType: ShiftWorkerType | string | null | undefined): string {
  return `${shiftWorkerLabel(workerType)} slot`;
}

export function shiftWorkerTypeForRole(role: Role | string | null | undefined): ShiftWorkerType {
  return role === "STUDENT" ? "ST" : "FT";
}

export function shiftWorkerLabelForRole(role: ShiftUserRoleKind): "Staff" | "Student" {
  return role === "STUDENT" ? "Student" : "Staff";
}

export function formatRoleSlotAssignmentOutcome(outcome: RoleSlotOutcomeLike, userName?: string | null): string {
  if (!outcome?.movedToMatchingSlot) return "Assigned shift";
  const assignee = userName?.trim() || "Worker";
  const assignedSlot = shiftWorkerSlotLabel(outcome.assignedWorkerType).toLowerCase();
  const originalSlot = shiftWorkerSlotLabel(outcome.originalWorkerType).toLowerCase();
  const verb = outcome.createdMatchingSlot ? "created" : "used";
  return `Assigned ${assignee} to ${assignedSlot}; ${verb} matching slot and left ${originalSlot} open.`;
}
