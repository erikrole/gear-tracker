"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CalendarEvent, ShiftGroup } from "@/app/(app)/schedule/_components/types";
import { handleAuthRedirect } from "@/lib/errors";
import { AREAS } from "@/types/areas";

/* ───── Types ───── */

export type GridAssignment = {
  id: string;
  status: string;
  hasConflict: boolean;
  conflictNote: string | null;
  user: { id: string; name: string; primaryArea: string | null; avatarUrl?: string | null };
};

export type GridShift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  assignments: GridAssignment[];
};

export type GridEvent = CalendarEvent & {
  shiftGroupId: string | null;
  isPremier: boolean;
  shifts: GridShift[];
};

/** Column descriptor: area + workerType combo */
export type GridColumn = {
  key: string; // "VIDEO-ST"
  area: string;
  workerType: string;
  label: string;
};

export type UseAssignmentGridResult = {
  events: GridEvent[];
  columns: GridColumn[];
  loading: boolean;
  error: false | "network" | "server";
  refetch: () => void;
  month: Date;
  setMonth: (d: Date) => void;
  sportFilter: string;
  setSportFilter: (v: string) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;
};

/* ───── Helpers ───── */

function monthRange(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

async function fetchGridData(
  eventsUrl: string,
  groupsUrl: string,
  signal?: AbortSignal,
): Promise<GridEvent[]> {
  const [evRes, sgRes] = await Promise.all([
    fetch(eventsUrl, { signal }),
    fetch(groupsUrl, { signal }),
  ]);

  if (handleAuthRedirect(evRes) || handleAuthRedirect(sgRes)) {
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!evRes.ok) throw new Error("events fetch failed");

  const evJson = await evRes.json();
  const events: CalendarEvent[] = evJson.data ?? [];

  const groupMap = new Map<string, ShiftGroup>();
  if (sgRes.ok) {
    const sgJson = await sgRes.json();
    const groups: ShiftGroup[] = sgJson.data ?? [];
    for (const g of groups) groupMap.set(g.eventId, g);
  }

  return events.map((ev) => {
    const g = groupMap.get(ev.id);
    const gridShifts: GridShift[] = (g?.shifts ?? []).map((s) => ({
      id: s.id,
      area: s.area,
      workerType: s.workerType,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      assignments: s.assignments.map((a) => ({
        id: a.id,
        status: a.status,
        hasConflict: (a as { hasConflict?: boolean }).hasConflict ?? false,
        conflictNote: (a as { conflictNote?: string | null }).conflictNote ?? null,
        user: a.user,
      })),
    }));
    return {
      ...ev,
      shiftGroupId: g?.id ?? null,
      isPremier: g?.isPremier ?? false,
      shifts: gridShifts,
    };
  });
}

/** Derive column order: area priority order, then FT before ST */
function deriveColumns(events: GridEvent[], areaFilter: string): GridColumn[] {
  const seen = new Set<string>();
  const cols: GridColumn[] = [];

  for (const area of AREAS) {
    if (areaFilter && area !== areaFilter) continue;
    for (const wt of ["FT", "ST"]) {
      const key = `${area}-${wt}`;
      const exists = events.some((e) => e.shifts.some((s) => s.area === area && s.workerType === wt));
      if (exists && !seen.has(key)) {
        seen.add(key);
        cols.push({
          key,
          area,
          workerType: wt,
          label: `${area} ${wt === "FT" ? "Staff" : "Student"}`,
        });
      }
    }
  }
  return cols;
}

/* ───── Hook ───── */

export function useAssignmentGrid(): UseAssignmentGridResult {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");

  const { start, end } = monthRange(month);
  const evParams = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    includePast: "true",
    limit: "200",
  });
  const sgParams = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: "200",
  });
  if (sportFilter) {
    evParams.set("sportCode", sportFilter);
    sgParams.set("sportCode", sportFilter);
  }

  const eventsUrl = `/api/calendar-events?${evParams}`;
  const groupsUrl = `/api/shift-groups?${sgParams}`;

  const {
    data: allEvents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["assignment-grid", eventsUrl, groupsUrl],
    queryFn: ({ signal }) => fetchGridData(eventsUrl, groupsUrl, signal),
  });

  const events = useMemo(() => {
    if (!areaFilter) return allEvents;
    return allEvents.filter((e) => e.shifts.some((s) => s.area === areaFilter));
  }, [allEvents, areaFilter]);

  const columns = useMemo(() => deriveColumns(allEvents, areaFilter), [allEvents, areaFilter]);

  const loadError: false | "network" | "server" =
    error && allEvents.length === 0
      ? (error as Error).name === "TypeError"
        ? "network"
        : "server"
      : false;

  return {
    events,
    columns,
    loading: isLoading,
    error: loadError,
    refetch,
    month,
    setMonth,
    sportFilter,
    setSportFilter,
    areaFilter,
    setAreaFilter,
  };
}
