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
