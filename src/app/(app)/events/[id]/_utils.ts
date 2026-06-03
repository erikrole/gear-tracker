export type CalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: string;
  rawSummary: string | null;
  rawLocationText: string | null;
  rawDescription: string | null;
  sportCode: string | null;
  opponent: string | null;
  isHome: boolean | null;
  subtitle: string | null;
  summaryLocked: boolean;
  isHomeLocked: boolean;
  locationLocked: boolean;
  location: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
};

export type ShiftGroupSummary = {
  id: string;
  isPremier: boolean;
  coverage?: { total: number; filled: number; percentage: number };
  shifts: Array<{
    id: string;
    area: string;
    workerType: string;
    workerLabel?: string;
    startsAt: string;
    endsAt: string;
    callStartsAt?: string | null;
    callEndsAt?: string | null;
    assignments: Array<{
      id: string;
      status: string;
      callStartsAt?: string | null;
      callEndsAt?: string | null;
      callNote?: string | null;
      hasConflict?: boolean;
      conflictNote?: string | null;
      user: { id: string; name: string; avatarUrl: string | null };
    }>;
  }>;
};

export type CommandCenterData = {
  shifts: Array<{
    id: string;
    area: string;
    workerType: string;
    workerLabel: string;
    startsAt: string;
    endsAt: string;
    callStartsAt: string;
    callEndsAt: string;
    assignment: {
      id: string;
      userId: string;
      userName: string;
      status: string;
      callStartsAt: string;
      callEndsAt: string;
      callNote: string | null;
      linkedBookingId: string | null;
      linkedBookingStatus: string | null;
    } | null;
    pendingRequests: number;
  }>;
  gearSummary: {
    total: number;
    byStatus: { draft: number; reserved: number; pendingPickup: number; checkedOut: number; completed: number };
  };
  missingGear: Array<{
    userId: string;
    userName: string;
    area: string;
    shiftId: string;
    assignmentId: string;
  }>;
};

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export const WORKER_LABELS: Record<string, string> = {
  FT: "Staff",
  ST: "Student",
};

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatDate(iso: string, allDay = false) {
  const d = allDay
    ? (() => { const u = new Date(iso); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); })()
    : new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
