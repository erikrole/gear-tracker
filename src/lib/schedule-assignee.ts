import { Role, ShiftWorkerType, type CollaboratorPolicyStatus } from "@prisma/client";
import { shiftWorkerTypeForProfile } from "@/lib/shift-display";

type ScheduleAssigneeProfile = {
  role: Role;
  staffingType?: ShiftWorkerType | null;
  collaboratorPolicy?: {
    status: CollaboratorPolicyStatus;
    grants: Array<{ capabilityKey: string }>;
  } | null;
};

/**
 * Collaborators are eligible only for deliberate Staff-slot assignment, and
 * only while their schedule-view policy remains active. Other scheduling
 * systems continue to use the ordinary staffing profile so this does not make
 * collaborators eligible for student trades, open work, or auto-fill.
 */
export function scheduleAssigneeWorkerType(profile: ScheduleAssigneeProfile): ShiftWorkerType | null {
  if (profile.role === Role.COLLABORATOR) {
    const eligible = profile.collaboratorPolicy?.status === "ACTIVE"
      && profile.collaboratorPolicy.grants.some((grant) => grant.capabilityKey === "PUBLISHED_SCHEDULE_VIEW");
    return eligible ? ShiftWorkerType.FT : null;
  }
  return shiftWorkerTypeForProfile(profile);
}
