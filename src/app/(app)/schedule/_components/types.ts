import type { BadgeProps } from "@/components/ui/badge";

/* ───── Types ───── */

export type CalendarEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: string;
  rawLocationText: string | null;
  sportCode: string | null;
  opponent: string | null;
  isHome: boolean | null;
  location: { id: string; name: string } | null;
  source: { name: string } | null;
};

export type ShiftUser = { id: string; name: string; primaryArea: string | null; avatarUrl?: string | null };

export type ShiftAssignment = {
  id: string;
  status: string;
  user: ShiftUser;
};

export type Shift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  assignments: ShiftAssignment[];
};

export type ShiftGroup = {
  id: string;
  eventId: string;
  isPremier: boolean;
  notes: string | null;
  event: { id: string; startsAt: string };
  shifts: Shift[];
  coverage: { total: number; filled: number; percentage: number };
};

/** Merged entry for display */
export type CalendarEntry = CalendarEvent & {
  shiftGroupId: string | null;
  coverage: { total: number; filled: number; percentage: number } | null;
  shifts: Shift[];
  isPremier: boolean;
};

/* ───── Constants ───── */

export { AREAS, AREA_LABELS } from "@/types/areas";
export type { Area } from "@/types/areas";

export const ACTIVE_STATUSES = ["DIRECT_ASSIGNED", "APPROVED"];

export const LS_VIEW_MODE = "schedule-view-mode";
export const LS_MY_SHIFTS = "schedule-my-shifts";

/* ───── Helpers ───── */

export function coverageVariant(pct: number): BadgeProps["variant"] {
  if (pct >= 100) return "green";
  if (pct > 0) return "orange";
  return "red";
}

export function coverageDot(pct: number): string {
  if (pct >= 100) return "var(--badge-green-bg, #22c55e)";
  if (pct > 0) return "var(--badge-orange-bg, #f59e0b)";
  return "var(--badge-red-bg, #ef4444)";
}

export function areaCoverage(shifts: Shift[], area: string) {
  const areaShifts = shifts.filter((s) => s.area === area);
  const activeAssignments = areaShifts.flatMap((s) =>
    s.assignments.filter((a) => ACTIVE_STATUSES.includes(a.status)),
  );
  return {
    filled: activeAssignments.length,
    total: areaShifts.length,
    assignedUsers: activeAssignments.map((a) => a.user),
  };
}

/** Check if user has an active assignment on any shift in this entry */
export function userHasShift(entry: CalendarEntry, userId: string): boolean {
  return entry.shifts.some((s) =>
    s.assignments.some(
      (a) => a.user.id === userId && ACTIVE_STATUSES.includes(a.status),
    ),
  );
}

/** Get user's assignment status label for display */
export function userShiftStatus(
  entry: CalendarEntry,
  userId: string,
): string | null {
  for (const s of entry.shifts) {
    for (const a of s.assignments) {
      if (a.user.id !== userId) continue;
      if (a.status === "APPROVED" || a.status === "DIRECT_ASSIGNED")
        return "Confirmed";
      if (a.status === "REQUESTED") return "Pending";
    }
  }
  return null;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
