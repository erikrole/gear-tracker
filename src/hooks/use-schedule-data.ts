"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CalendarEvent,
  CalendarEntry,
  ShiftGroup,
} from "@/app/(app)/schedule/_components/types";
import { userHasShift, LS_VIEW_MODE, LS_MY_SHIFTS } from "@/app/(app)/schedule/_components/types";
import { handleAuthRedirect } from "@/lib/errors";

export type ViewMode = "list" | "calendar" | "week";

export type HomeAwayFilter = "all" | "home" | "away";

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
  myHours: { thisWeek: number; thisMonth: number; shiftCountWeek: number; shiftCountMonth: number } | null;
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
    };
  });
}

/** Build schedule fetch URL based on current view params */
function buildScheduleUrls(viewMode: string, calMonth: Date, weekStart: Date, includePast: boolean, sportFilter: string) {
  const evParams = new URLSearchParams({ limit: "200" });
  const sgParams = new URLSearchParams();

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

type MeResponse = { user: { id: string; role: string } };

async function fetchMe(): Promise<MeResponse | null> {
  const r = await fetch("/api/me");
  if (handleAuthRedirect(r)) return null;
  if (!r.ok) return null;
  return r.json();
}

async function fetchTradeCount(): Promise<number> {
  const r = await fetch("/api/shift-trades?status=OPEN");
  if (!r.ok) return 0;
  const j = await r.json();
  return j?.data?.length ?? 0;
}

type MyHours = { thisWeek: number; thisMonth: number; shiftCountWeek: number; shiftCountMonth: number };

async function fetchMyHours(): Promise<MyHours | null> {
  const r = await fetch("/api/shifts/my-hours");
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data ?? null;
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
  // View — restore from localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(LS_VIEW_MODE);
    if (stored === "calendar" || stored === "week") return stored;
    return "list";
  });
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
  const [myShiftsOnly, setMyShiftsOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_MY_SHIFTS) === "true";
  });

  // UI state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Persist view mode
  useEffect(() => { localStorage.setItem(LS_VIEW_MODE, viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem(LS_MY_SHIFTS, String(myShiftsOnly)); }, [myShiftsOnly]);

  // --- React Query: user info ---
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const currentUserId = meData?.user?.id ?? "";
  const currentUserRole = meData?.user?.role ?? "STUDENT";

  // Set default myShiftsOnly for students
  useEffect(() => {
    if (currentUserRole === "STUDENT" && localStorage.getItem(LS_MY_SHIFTS) === null) {
      setMyShiftsOnly(true);
    }
  }, [currentUserRole]);

  // --- React Query: trade count ---
  const { data: tradeCount = 0, refetch: refetchTrades } = useQuery({
    queryKey: ["shift-trades", "OPEN", "count"],
    queryFn: fetchTradeCount,
    refetchOnWindowFocus: true,
  });

  // --- React Query: my shift hours ---
  const { data: myHours = null } = useQuery({
    queryKey: ["shifts", "my-hours"],
    queryFn: fetchMyHours,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  // --- React Query: schedule entries ---
  const { eventsUrl, groupsUrl } = buildScheduleUrls(viewMode, calMonth, weekStart, includePast, sportFilter);
  const scheduleQueryKey = ["schedule", eventsUrl, groupsUrl];

  const { data: entries = [], isLoading, error: scheduleError, refetch: refetchSchedule } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: ({ signal }) => fetchSchedule(eventsUrl, groupsUrl, signal),
    refetchOnWindowFocus: true,
  });

  // Classify error — only show error screen when no cached data
  const loadError: false | "network" | "server" =
    scheduleError && entries.length === 0
      ? (scheduleError as Error).name === "TypeError" ? "network" : "server"
      : false;

  // Client-side filtering
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (myShiftsOnly && currentUserId) {
      result = result.filter((e) => userHasShift(e, currentUserId));
    }
    if (homeAwayFilter === "home") {
      result = result.filter((e) => e.isHome === true);
    } else if (homeAwayFilter === "away") {
      // Neutral (null) is treated as away
      result = result.filter((e) => e.isHome !== true);
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
  }, [entries, homeAwayFilter, areaFilter, coverageFilter, myShiftsOnly, currentUserId]);

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
      groups[groups.length - 1][1].push(entry);
    }
    return groups;
  }, [filteredEntries]);

  const hasFilters = !!(sportFilter || areaFilter || coverageFilter || homeAwayFilter !== "all" || includePast || myShiftsOnly);

  const loadData = useCallback(async () => {
    await refetchSchedule();
  }, [refetchSchedule]);

  return {
    entries,
    filteredEntries,
    groupedEntries,
    loading: isLoading,
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
    myHours,
  };
}
