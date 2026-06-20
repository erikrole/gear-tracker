import type { Role, ShiftWorkerType } from "@prisma/client";

export type ShiftWorkerKind = ShiftWorkerType;
export type ShiftUserRoleKind = Role | string | null | undefined;
export type ShiftWorkerProfile = {
  role?: ShiftUserRoleKind;
  gradYear?: number | null;
  studentYearOverride?: string | null;
  sportAssignments?: unknown[] | null;
  areaAssignments?: unknown[] | null;
} | null | undefined;
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

function normalizeRole(role: ShiftUserRoleKind): Role | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "STAFF" || normalized === "STUDENT"
    ? normalized
    : null;
}

function hasStudentProfileSignal(profile: ShiftWorkerProfile): boolean {
  return Boolean(
    profile
      && (
        profile.gradYear != null
        || profile.studentYearOverride != null
        || (profile.sportAssignments?.length ?? 0) > 0
        || (profile.areaAssignments?.length ?? 0) > 0
      ),
  );
}

export function shiftWorkerTypeForRole(role: Role | string | null | undefined): ShiftWorkerType {
  return normalizeRole(role) === "STUDENT" ? "ST" : "FT";
}

export function shiftWorkerTypeForProfile(profile: ShiftWorkerProfile): ShiftWorkerType | null {
  const role = normalizeRole(profile?.role);
  if (role === "STUDENT" || hasStudentProfileSignal(profile)) return "ST";
  if (role === "STAFF" || role === "ADMIN") return "FT";
  return null;
}

export function shiftWorkerLabelForRole(role: ShiftUserRoleKind): "Staff" | "Student" | null {
  const normalized = normalizeRole(role);
  if (normalized === "STUDENT") return "Student";
  if (normalized === "STAFF" || normalized === "ADMIN") return "Staff";
  return null;
}

export function shiftWorkerLabelForProfile(profile: ShiftWorkerProfile): "Staff" | "Student" | null {
  const workerType = shiftWorkerTypeForProfile(profile);
  return workerType ? shiftWorkerLabel(workerType) : null;
}

export function formatRoleSlotAssignmentOutcome(outcome: RoleSlotOutcomeLike, userName?: string | null): string {
  if (!outcome?.movedToMatchingSlot) return "Assigned shift";
  const assignee = userName?.trim() || "Worker";
  const assignedSlot = shiftWorkerSlotLabel(outcome.assignedWorkerType).toLowerCase();
  const originalSlot = shiftWorkerSlotLabel(outcome.originalWorkerType).toLowerCase();
  const verb = outcome.createdMatchingSlot ? "created" : "used";
  return `Assigned ${assignee} to ${assignedSlot}; ${verb} matching slot and left ${originalSlot} open.`;
}
