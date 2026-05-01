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
    startsAt: string;
    endsAt: string;
    assignments: Array<{
      id: string;
      status: string;
      user: { id: string; name: string; avatarUrl: string | null };
    }>;
  }>;
};

export type CommandCenterData = {
  shifts: Array<{
    id: string;
    area: string;
    workerType: string;
    startsAt: string;
    endsAt: string;
    assignment: { id: string; userId: string; userName: string; status: string; linkedBookingId: string | null; linkedBookingStatus: string | null } | null;
    pendingRequests: number;
  }>;
  gearSummary: {
    total: number;
    byStatus: { draft: number; reserved: number; checkedOut: number; completed: number };
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

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

