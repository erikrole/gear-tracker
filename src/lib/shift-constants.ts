import type { ShiftAssignmentStatus } from "@prisma/client";

/** Assignment statuses that represent an active (non-terminal) assignment */
export const ACTIVE_ASSIGNMENT_STATUSES: ShiftAssignmentStatus[] = [
  "DIRECT_ASSIGNED",
  "APPROVED",
];
