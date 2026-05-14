"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  CalendarEvent,
  CalendarEntry,
  ShiftGroup,
} from "@/app/(app)/schedule/_components/types";
import { userHasShift, LS_VIEW_MODE, LS_MY_SHIFTS } from "@/app/(app)/schedule/_components/types";
import { handleAuthRedirect } from "@/lib/errors";
import type { VenueFilter } from "@/lib/venue-tone";

export type ViewMode = "list" | "calendar" | "week";

export type HomeAwayFilter = VenueFilter;

export type ScheduleFilters = {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  sportFilter: string;
  setSportFilter: (v: string) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;
  coverageFilter: string;
  setCoverageFilter: (v: string) => void;
  homeAwayFilter: HomeAwayFilter;
  setHomeAwayFilter: (v: HomeAwayFilter) => void;
  includePast: boolean;
  setIncludePast: (v: boolean) => void;
  myShiftsOnly: boolean;
  setMyShiftsOnly: (v: boolean) => void;
  hasFilters: boolean;
  clearAll: () => void;
};

export type UseScheduleDataResult = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  groupedEntries: [string, CalendarEntry[]][];
  loading: boolean;
  loadError: false | "network" | "server";
  loadData: () => Promise<void>;
  filters: ScheduleFilters;
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  currentUserId: string;
  currentUserRole: string;
  openTradeCount: number;
  tradeSheetOpen: boolean;
  setTradeSheetOpen: (v: boolean) => void;
  loadTradeCount: () => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  expandedDay: number | null;
  setExpandedDay: (d: number | null) => void;
};

/** Merge events + shift groups into unified entries */
function mergeData(events: CalendarEvent[], groups: ShiftGroup[]): CalendarEntry[] {
  const groupByEventId = new Map<string, ShiftGroup>();
  for (const g of groups) groupByEventId.set(g.eventId, g);

  return events.map((ev) => {
    const g = groupByEventId.get(ev.id);
    return {
      ...ev,
      shiftGroupId: g?.id ?? null,
      coverage: g?.coverage ?? null,
      shifts: g?.shifts ?? [],
      isPremier: g?.isPremier ?? false,
      archivedAt: g?.archivedAt ?? null,
    };
  });
}

/** Build schedule fetch URL based on current view params */
function buildScheduleUrls(viewMode: string, calMonth: Date, weekStart: Date, includePast: boolean, sportFilter: string) {
  const evParams = new URLSearchParams({ limit: "200" });
  const sgParams = new URLSearchParams({ limit: "200" });

  if (viewMode === "calendar") {
    const startDate = calMonth.toISOString();
    const endDate = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    evParams.set("startDate", startDate);
    evParams.set("endDate", endDate);
    evParams.set("includePast", "true");
    sgParams.set("startDate", startDate);
    sgParams.set("endDate", endDate);
  } else if (viewMode === "week") {
    const startDate = weekStart.toISOString();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const endDate = weekEnd.toISOString();
    evParams.set("startDate", startDate);
    evParams.set("endDate", endDate);
    evParams.set("includePast", "true");
    sgParams.set("startDate", startDate);
    sgParams.set("endDate", endDate);
  } else {
    if (!includePast) {
      // Use start-of-today to avoid constantly changing URLs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = today.toISOString();
      evParams.set("startDate", startDate);
      sgParams.set("startDate", startDate);
    } else {
      evParams.set("includePast", "true");
    }
  }

  if (sportFilter) {
    evParams.set("sportCode", sportFilter);
    sgParams.set("sportCode", sportFilter);
  }

  return {
    eventsUrl: `/api/calendar-events?${evParams}`,
    groupsUrl: `/api/shift-groups?${sgParams}`,
  };
}

async function fetchSchedule(eventsUrl: string, groupsUrl: string, signal?: AbortSignal): Promise<CalendarEntry[]> {
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

  let groups: ShiftGroup[] = [];
  if (sgRes.ok) {
    const sgJson = await sgRes.json();
    groups = sgJson.data ?? [];
  }

  return mergeData(events, groups);
}

async function fetchTradeCount(): Promise<number> {
  const r = await fetch("/api/shift-trades?status=OPEN");
  if (!r.ok) return 0;
  const j = await r.json();
  return j?.data?.length ?? 0;
}

/** Get Monday of the week containing the given date */
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0=Sun
  result.setDate(result.getDate() - ((day + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function useScheduleData(): UseScheduleDataResult {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  // Filters
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("");
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");
  const [includePast, setIncludePast] = useState(false);
  const [myShiftsOnly, setMyShiftsOnly] = useState(false);

  // UI state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    const storedView = localStorage.getItem(LS_VIEW_MODE);
    if (storedView === "calendar" || storedView === "week") {
      setViewMode(storedView);
    }

    const storedMyShifts = localStorage.getItem(LS_MY_SHIFTS);
    if (storedMyShifts !== null) {
      setMyShiftsOnly(storedMyShifts === "true");
    }

    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    localStorage.setItem(LS_VIEW_MODE, viewMode);
  }, [preferencesLoaded, viewMode]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    localStorage.setItem(LS_MY_SHIFTS, String(myShiftsOnly));
  }, [myShiftsOnly, preferencesLoaded]);

  // --- React Query: user info ---
  const { data: meData } = useCurrentUser();
  const currentUserId = meData?.id ?? "";
  const currentUserRole = meData?.role ?? "STUDENT";

  // Set default myShiftsOnly for students
  useEffect(() => {
    if (!preferencesLoaded) return;
    if (meData?.role === "STUDENT" && localStorage.getItem(LS_MY_SHIFTS) === null) {
      setMyShiftsOnly(true);
    }
  }, [meData?.role, preferencesLoaded]);

  // --- React Query: trade count ---
  const { data: tradeCount = 0, refetch: refetchTrades } = useQuery({
    queryKey: ["shift-trades", "OPEN", "count"],
    queryFn: fetchTradeCount,
  });

  // --- React Query: schedule entries ---
  const { eventsUrl, groupsUrl } = buildScheduleUrls(viewMode, calMonth, weekStart, includePast, sportFilter);
  const scheduleQueryKey = ["schedule", eventsUrl, groupsUrl];

  const { data: entries = [], isLoading, error: scheduleError, refetch: refetchSchedule } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: ({ signal }) => fetchSchedule(eventsUrl, groupsUrl, signal),
  });
  const visibleEntries = preferencesLoaded ? entries : [];
  const loading = !preferencesLoaded || isLoading;

  // Classify error — only show error screen when no cached data
  const loadError: false | "network" | "server" =
    preferencesLoaded && scheduleError && visibleEntries.length === 0
      ? (scheduleError as Error).name === "TypeError" ? "network" : "server"
      : false;

  // Client-side filtering
  const filteredEntries = useMemo(() => {
    let result = visibleEntries;
    if (myShiftsOnly && currentUserId) {
      result = result.filter((e) => userHasShift(e, currentUserId));
    }
    if (homeAwayFilter === "home") {
      result = result.filter((e) => e.isHome === true);
    } else if (homeAwayFilter === "away") {
      result = result.filter((e) => e.isHome === false);
    } else if (homeAwayFilter === "neutral") {
      result = result.filter((e) => e.isHome === null && e.opponent);
    }
    if (areaFilter) {
      result = result.filter((e) => e.shifts.some((s) => s.area === areaFilter));
    }
    if (coverageFilter === "unfilled") {
      result = result.filter((e) => !e.coverage || e.coverage.percentage < 100);
    } else if (coverageFilter === "filled") {
      result = result.filter((e) => e.coverage && e.coverage.percentage >= 100);
    }
    return result;
  }, [visibleEntries, homeAwayFilter, areaFilter, coverageFilter, myShiftsOnly, currentUserId]);

  // Group entries by date for list view
  const groupedEntries = useMemo(() => {
    const groups: [string, CalendarEntry[]][] = [];
    let lastKey = "";
    for (const entry of filteredEntries) {
      const key = new Date(entry.startsAt).toDateString();
      if (key !== lastKey) {
        groups.push([key, []]);
        lastKey = key;
      }
      groups[groups.length - 1]![1]!.push(entry); // at least one group pushed above in this iteration
    }
    return groups;
  }, [filteredEntries]);

  const hasFilters = !!(sportFilter || areaFilter || coverageFilter || homeAwayFilter !== "all" || includePast || myShiftsOnly);

  const loadData = useCallback(async () => {
    await refetchSchedule();
  }, [refetchSchedule]);

  return {
    entries: visibleEntries,
    filteredEntries,
    groupedEntries,
    loading,
    loadError,
    loadData,
    filters: {
      viewMode,
      setViewMode,
      sportFilter,
      setSportFilter,
      areaFilter,
      setAreaFilter,
      coverageFilter,
      setCoverageFilter,
      homeAwayFilter,
      setHomeAwayFilter,
      includePast,
      setIncludePast,
      myShiftsOnly,
      setMyShiftsOnly,
      hasFilters,
      clearAll: () => {
        setSportFilter("");
        setAreaFilter("");
        setCoverageFilter("");
        setHomeAwayFilter("all");
        setIncludePast(false);
        setMyShiftsOnly(false);
      },
    },
    calMonth,
    setCalMonth,
    weekStart,
    setWeekStart,
    currentUserId,
    currentUserRole,
    openTradeCount: tradeCount,
    tradeSheetOpen,
    setTradeSheetOpen,
    loadTradeCount: () => { refetchTrades(); },
    selectedGroupId,
    setSelectedGroupId,
    expandedRowId,
    setExpandedRowId,
    expandedDay,
    setExpandedDay,
  };
}
