import type { Role, ShiftWorkerType } from "@prisma/client";

export type ShiftWorkerKind = ShiftWorkerType;

export function shiftWorkerLabel(workerType: ShiftWorkerType | string | null | undefined): "Staff" | "Student" {
  return workerType === "FT" ? "Staff" : "Student";
}

export function shiftWorkerSlotLabel(workerType: ShiftWorkerType | string | null | undefined): string {
  return `${shiftWorkerLabel(workerType)} slot`;
}

export function shiftWorkerTypeForRole(role: Role | string | null | undefined): ShiftWorkerType {
  return role === "STUDENT" ? "ST" : "FT";
}

export function assignedRoleMismatchLabel(args: {
  plannedWorkerType: ShiftWorkerType | string | null | undefined;
  assignedRole: Role | string | null | undefined;
}): string | null {
  const assignedWorkerType = shiftWorkerTypeForRole(args.assignedRole);
  if (assignedWorkerType === args.plannedWorkerType) return null;
  return `${shiftWorkerLabel(assignedWorkerType)} assigned to ${shiftWorkerSlotLabel(args.plannedWorkerType)}`;
}
