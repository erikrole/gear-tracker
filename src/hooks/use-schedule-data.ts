"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  CalendarEvent,
  CalendarEntry,
  ShiftGroup,
} from "@/app/(app)/schedule/_components/types";
import { getMonday, userHasShift, LS_VIEW_MODE, LS_MY_SHIFTS } from "@/app/(app)/schedule/_components/types";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { calendarDate } from "@/lib/format";
import {
  buildScheduleSourceSignal,
  getCalendarSourceFreshness,
  type CalendarSourceFreshnessInput,
  type ScheduleSourceSignal,
} from "@/lib/calendar-source-freshness";
import { venueToneFromEvent, type VenueFilter } from "@/lib/venue-tone";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import type { ScheduleAutomationDigest } from "@/lib/schedule-automation-types";
import {
  filterEntriesForScheduleQueue,
  parseScheduleQueue,
  SCHEDULE_QUEUE_META,
  type ScheduleQueue,
  type ScheduleQueueMeta,
} from "@/lib/schedule-queues";

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
  includeArchived: boolean;
  setIncludeArchived: (v: boolean) => void;
  myShiftsOnly: boolean;
  setMyShiftsOnly: (v: boolean) => void;
  queue: ScheduleQueue | null;
  queueMeta: ScheduleQueueMeta | null;
  setQueue: (v: ScheduleQueue | null) => void;
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
  sourceSignal: ScheduleSourceSignal | null;
  scheduleHealth: ScheduleHealthSnapshot | null;
  scheduleAutomation: ScheduleAutomationDigest | null;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  expandedDay: number | null;
  setExpandedDay: (d: number | null) => void;
};

const SCHEDULE_READ_FETCH_INIT: RequestInit = { cache: "no-store" };
const SCHEDULE_FRESH_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
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
      archivedAt: g?.archivedAt ?? null,
      publication: g?.publication ?? null,
    };
  });
}

/** Build schedule fetch URL based on current view params */
function buildScheduleUrls(viewMode: string, calMonth: Date, weekStart: Date, includePast: boolean, includeArchived: boolean, sportFilter: string) {
  const evParams = new URLSearchParams({ limit: "200" });
  const sgParams = new URLSearchParams({ limit: "200" });
  const healthParams = new URLSearchParams();
  const automationParams = new URLSearchParams();

  if (viewMode === "calendar") {
    const startDate = calMonth.toISOString();
    const endDate = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    evParams.set("startDate", startDate);
    evParams.set("endDate", endDate);
    evParams.set("includePast", "true");
    sgParams.set("startDate", startDate);
    sgParams.set("endDate", endDate);
    healthParams.set("startDate", startDate);
    healthParams.set("endDate", endDate);
    healthParams.set("includePast", "true");
    automationParams.set("startDate", startDate);
    automationParams.set("endDate", endDate);
    automationParams.set("includePast", "true");
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
    healthParams.set("startDate", startDate);
    healthParams.set("endDate", endDate);
    healthParams.set("includePast", "true");
    automationParams.set("startDate", startDate);
    automationParams.set("endDate", endDate);
    automationParams.set("includePast", "true");
  } else {
    if (!includePast) {
      // Use start-of-today to avoid constantly changing URLs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = today.toISOString();
      evParams.set("startDate", startDate);
      sgParams.set("startDate", startDate);
      healthParams.set("startDate", startDate);
      automationParams.set("startDate", startDate);
    } else {
      evParams.set("includePast", "true");
      healthParams.set("includePast", "true");
      automationParams.set("includePast", "true");
    }
  }

  if (sportFilter) {
    evParams.set("sportCode", sportFilter);
    sgParams.set("sportCode", sportFilter);
    healthParams.set("sportCode", sportFilter);
    automationParams.set("sportCode", sportFilter);
  }

  // Archived events are always in the past — also pass includePast so the
  // startsAt >= now default doesn't filter them out.
  if (includeArchived) {
    evParams.set("includeArchived", "true");
    evParams.set("includePast", "true");
    healthParams.set("includeArchived", "true");
    healthParams.set("includePast", "true");
    automationParams.set("includeArchived", "true");
    automationParams.set("includePast", "true");
  }

  return {
    eventsUrl: `/api/calendar-events?${evParams}`,
    groupsUrl: `/api/shift-groups?${sgParams}`,
    healthUrl: `/api/schedule/health?${healthParams}`,
    automationUrl: `/api/schedule/automation?${automationParams}`,
  };
}

async function fetchSchedule(eventsUrl: string, groupsUrl: string, signal?: AbortSignal): Promise<CalendarEntry[]> {
  const [evRes, sgRes] = await Promise.all([
    fetch(eventsUrl, { ...SCHEDULE_READ_FETCH_INIT, signal }),
    fetch(groupsUrl, { ...SCHEDULE_READ_FETCH_INIT, signal }),
  ]);

  if (handleAuthRedirect(evRes) || handleAuthRedirect(sgRes)) {
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!evRes.ok) throw new Error("events fetch failed");

  const evJson = await parseJsonSafely<{ data?: CalendarEvent[] }>(evRes);
  if (!evJson?.data) throw new Error("events response malformed");
  const events: CalendarEvent[] = evJson.data ?? [];

  let groups: ShiftGroup[] = [];
  if (sgRes.ok) {
    const sgJson = await parseJsonSafely<{ data?: ShiftGroup[] }>(sgRes);
    if (!sgJson?.data) throw new Error("shift groups response malformed");
    groups = sgJson.data ?? [];
  }

  return mergeData(events, groups);
}

async function fetchTradeCount(): Promise<number> {
  const r = await fetch("/api/shift-trades?status=OPEN&limit=1", SCHEDULE_READ_FETCH_INIT);
  if (handleAuthRedirect(r)) return 0;
  if (!r.ok) return 0;
  const j = await parseJsonSafely<{ total?: number; data?: unknown[] }>(r);
  return typeof j?.total === "number" ? j.total : j?.data?.length ?? 0;
}

async function fetchCalendarSources(signal?: AbortSignal): Promise<CalendarSourceFreshnessInput[]> {
  const res = await fetch("/api/calendar-sources", { ...SCHEDULE_READ_FETCH_INIT, signal });
  if (handleAuthRedirect(res, "/schedule")) {
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!res.ok) throw new Error("calendar sources fetch failed");

  const json = await parseJsonSafely<{ data?: CalendarSourceFreshnessInput[] }>(res);
  if (!json?.data) throw new Error("calendar sources response malformed");
  return json.data;
}

async function fetchScheduleHealth(url: string, signal?: AbortSignal): Promise<ScheduleHealthSnapshot> {
  const res = await fetch(url, { ...SCHEDULE_READ_FETCH_INIT, signal });
  if (handleAuthRedirect(res, "/schedule")) {
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!res.ok) throw new Error("schedule health fetch failed");

  const json = await parseJsonSafely<{ data?: ScheduleHealthSnapshot }>(res);
  if (!json?.data) throw new Error("schedule health response malformed");
  return json.data;
}

async function fetchScheduleAutomation(url: string, signal?: AbortSignal): Promise<ScheduleAutomationDigest> {
  const res = await fetch(url, { ...SCHEDULE_READ_FETCH_INIT, signal });
  if (handleAuthRedirect(res, "/schedule")) {
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!res.ok) throw new Error("schedule automation fetch failed");

  const json = await parseJsonSafely<{ data?: ScheduleAutomationDigest }>(res);
  if (!json?.data) throw new Error("schedule automation response malformed");
  return json.data;
}

export function useScheduleData(): UseScheduleDataResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [myShiftsOnly, setMyShiftsOnly] = useState(false);

  // UI state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const activeQueue = parseScheduleQueue(searchParams.get("queue"));
  const activeQueueMeta = activeQueue ? SCHEDULE_QUEUE_META[activeQueue] : null;

  const setQueue = useCallback((queue: ScheduleQueue | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (queue) {
      params.set("queue", queue);
      setViewMode("list");
    } else {
      params.delete("queue");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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
  const canViewSourceStatus = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const canViewScheduleHealth = currentUserRole === "ADMIN" || currentUserRole === "STAFF";

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
    ...SCHEDULE_FRESH_QUERY_OPTIONS,
  });

  const {
    data: calendarSources = [],
    isLoading: sourceStatusLoading,
    error: sourceStatusError,
    refetch: refetchSources,
  } = useQuery({
    queryKey: ["calendar-sources", "schedule-source-signal"],
    queryFn: ({ signal }) => fetchCalendarSources(signal),
    enabled: canViewSourceStatus,
    ...SCHEDULE_FRESH_QUERY_OPTIONS,
  });
  const staleSourceIds = useMemo(() => {
    return new Set(
      calendarSources
        .filter((source) => {
          const state = getCalendarSourceFreshness(source);
          return state === "error" || state === "stale" || state === "never-synced";
        })
        .map((source) => source.id),
    );
  }, [calendarSources]);

  // --- React Query: schedule entries ---
  const { eventsUrl, groupsUrl, healthUrl, automationUrl } = buildScheduleUrls(viewMode, calMonth, weekStart, includePast, includeArchived, sportFilter);
  const scheduleQueryKey = ["schedule", eventsUrl, groupsUrl];

  const { data: entries = [], isLoading, error: scheduleError, refetch: refetchSchedule } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: ({ signal }) => fetchSchedule(eventsUrl, groupsUrl, signal),
    ...SCHEDULE_FRESH_QUERY_OPTIONS,
  });
  const { data: scheduleHealth = null, refetch: refetchScheduleHealth } = useQuery({
    queryKey: ["schedule-health", healthUrl],
    queryFn: ({ signal }) => fetchScheduleHealth(healthUrl, signal),
    enabled: canViewScheduleHealth,
    ...SCHEDULE_FRESH_QUERY_OPTIONS,
  });
  const { data: scheduleAutomation = null, refetch: refetchScheduleAutomation } = useQuery({
    queryKey: ["schedule-automation", automationUrl],
    queryFn: ({ signal }) => fetchScheduleAutomation(automationUrl, signal),
    enabled: canViewScheduleHealth,
    ...SCHEDULE_FRESH_QUERY_OPTIONS,
  });
  const visibleEntries = useMemo(
    () => preferencesLoaded ? entries : [],
    [entries, preferencesLoaded],
  );
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
    if (homeAwayFilter !== "all") {
      result = result.filter((e) => venueToneFromEvent(e) === homeAwayFilter);
    }
    if (areaFilter) {
      result = result.filter((e) => e.shifts.some((s) => s.area === areaFilter));
    }
    if (coverageFilter === "unfilled") {
      result = result.filter((e) => !e.coverage || e.coverage.percentage < 100);
    } else if (coverageFilter === "filled") {
      result = result.filter((e) => e.coverage && e.coverage.percentage >= 100);
    }
    result = filterEntriesForScheduleQueue({
      entries: result,
      queue: activeQueue,
      health: scheduleHealth,
      currentUserId,
      staleSourceIds,
    });
    return result;
  }, [visibleEntries, homeAwayFilter, areaFilter, coverageFilter, myShiftsOnly, currentUserId, activeQueue, scheduleHealth, staleSourceIds]);

  // Group entries by date for list view
  const groupedEntries = useMemo(() => {
    const groups: [string, CalendarEntry[]][] = [];
    let lastKey = "";
    for (const entry of filteredEntries) {
      const key = calendarDate(entry.startsAt, entry.allDay).toDateString();
      if (key !== lastKey) {
        groups.push([key, []]);
        lastKey = key;
      }
      groups[groups.length - 1]![1]!.push(entry); // at least one group pushed above in this iteration
    }
    return groups;
  }, [filteredEntries]);

  const hasFilters = !!(sportFilter || areaFilter || coverageFilter || homeAwayFilter !== "all" || includePast || includeArchived || myShiftsOnly || activeQueue);

  const sourceSignal = useMemo(() => {
    if (!canViewSourceStatus) return null;
    const status = sourceStatusLoading && calendarSources.length === 0
      ? "loading"
      : sourceStatusError && calendarSources.length === 0
        ? "unavailable"
        : "ready";
    return buildScheduleSourceSignal(filteredEntries, calendarSources, { status });
  }, [calendarSources, canViewSourceStatus, filteredEntries, sourceStatusError, sourceStatusLoading]);

  const loadData = useCallback(async () => {
    const tasks: Promise<unknown>[] = [refetchSchedule()];
    if (canViewScheduleHealth) tasks.push(refetchScheduleHealth());
    if (canViewScheduleHealth) tasks.push(refetchScheduleAutomation());
    if (canViewSourceStatus) tasks.push(refetchSources());
    await Promise.allSettled(tasks);
  }, [canViewScheduleHealth, canViewSourceStatus, refetchSchedule, refetchScheduleAutomation, refetchScheduleHealth, refetchSources]);

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
      includeArchived,
      setIncludeArchived,
      myShiftsOnly,
      setMyShiftsOnly,
      queue: activeQueue,
      queueMeta: activeQueueMeta,
      setQueue,
      hasFilters,
      clearAll: () => {
        setSportFilter("");
        setAreaFilter("");
        setCoverageFilter("");
        setHomeAwayFilter("all");
        setIncludePast(false);
        setIncludeArchived(false);
        setMyShiftsOnly(false);
        setQueue(null);
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
    loadTradeCount: refetchTrades,
    sourceSignal,
    scheduleHealth,
    scheduleAutomation,
    selectedGroupId,
    setSelectedGroupId,
    expandedRowId,
    setExpandedRowId,
    expandedDay,
    setExpandedDay,
  };
}
