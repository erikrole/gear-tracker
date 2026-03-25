"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CalendarEvent,
  CalendarEntry,
  ShiftGroup,
} from "@/app/(app)/schedule/_components/types";
import { userHasShift, LS_VIEW_MODE, LS_MY_SHIFTS } from "@/app/(app)/schedule/_components/types";

export type ScheduleFilters = {
  viewMode: "list" | "calendar";
  setViewMode: (v: "list" | "calendar") => void;
  sportFilter: string;
  setSportFilter: (v: string) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;
  coverageFilter: string;
  setCoverageFilter: (v: string) => void;
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

export function useScheduleData(): UseScheduleDataResult {
  // Data
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<false | "network" | "server">(
    false,
  );

  // View — restore from localStorage
  const [viewMode, setViewMode] = useState<"list" | "calendar">(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem(LS_VIEW_MODE);
    return stored === "calendar" ? "calendar" : "list";
  });
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Filters
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [myShiftsOnly, setMyShiftsOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_MY_SHIFTS) === "true";
  });

  // Inline coverage expansion
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Trade Board sheet
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const [openTradeCount, setOpenTradeCount] = useState(0);

  // Detail panel
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("STUDENT");

  // AbortController for fetch race prevention
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem(LS_VIEW_MODE, viewMode);
  }, [viewMode]);

  // Persist my-shifts toggle
  useEffect(() => {
    localStorage.setItem(LS_MY_SHIFTS, String(myShiftsOnly));
  }, [myShiftsOnly]);

  // Fetch user info
  useEffect(() => {
    fetch("/api/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (j?.user) {
          setCurrentUserId(j.user.id);
          setCurrentUserRole(j.user.role);
          if (
            j.user.role === "STUDENT" &&
            localStorage.getItem(LS_MY_SHIFTS) === null
          ) {
            setMyShiftsOnly(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch open trade count
  const loadTradeCount = useCallback(() => {
    fetch("/api/shift-trades?status=OPEN")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setOpenTradeCount(j.data.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTradeCount();
  }, [loadTradeCount]);

  // Merge events + shift groups
  const mergeData = useCallback(
    (events: CalendarEvent[], groups: ShiftGroup[]): CalendarEntry[] => {
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
    },
    [],
  );

  // Load data
  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!hasLoadedRef.current) setLoading(true);
    setLoadError(false);
    try {
      const evParams = new URLSearchParams({ limit: "200" });
      const sgParams = new URLSearchParams();

      if (viewMode === "calendar") {
        const startDate = calMonth.toISOString();
        const endDate = new Date(
          calMonth.getFullYear(),
          calMonth.getMonth() + 1,
          0,
          23,
          59,
          59,
        ).toISOString();
        evParams.set("startDate", startDate);
        evParams.set("endDate", endDate);
        evParams.set("includePast", "true");
        sgParams.set("startDate", startDate);
        sgParams.set("endDate", endDate);
      } else {
        if (!includePast) {
          const now = new Date().toISOString();
          evParams.set("startDate", now);
          sgParams.set("startDate", now);
        } else {
          evParams.set("includePast", "true");
        }
      }

      if (sportFilter) {
        evParams.set("sportCode", sportFilter);
        sgParams.set("sportCode", sportFilter);
      }

      const [evRes, sgRes] = await Promise.all([
        fetch(`/api/calendar-events?${evParams}`, {
          signal: controller.signal,
        }),
        fetch(`/api/shift-groups?${sgParams}`, { signal: controller.signal }),
      ]);

      if (evRes.status === 401 || sgRes.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!evRes.ok) throw new Error("events fetch failed");

      const evJson = await evRes.json();
      const events: CalendarEvent[] = evJson.data ?? [];

      let groups: ShiftGroup[] = [];
      if (sgRes.ok) {
        const sgJson = await sgRes.json();
        groups = sgJson.data ?? [];
      }

      setEntries(mergeData(events, groups));
      hasLoadedRef.current = true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const isNetwork =
        err instanceof TypeError &&
        (err as TypeError).message.includes("fetch");
      setLoadError(isNetwork ? "network" : "server");
    }
    setLoading(false);
  }, [viewMode, calMonth, includePast, sportFilter, mergeData]);

  useEffect(() => {
    loadData();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadData]);

  // Client-side filtering
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (myShiftsOnly && currentUserId) {
      result = result.filter((e) => userHasShift(e, currentUserId));
    }
    if (areaFilter) {
      result = result.filter((e) =>
        e.shifts.some((s) => s.area === areaFilter),
      );
    }
    if (coverageFilter === "unfilled") {
      result = result.filter(
        (e) => !e.coverage || e.coverage.percentage < 100,
      );
    } else if (coverageFilter === "filled") {
      result = result.filter(
        (e) => e.coverage && e.coverage.percentage >= 100,
      );
    }
    return result;
  }, [entries, areaFilter, coverageFilter, myShiftsOnly, currentUserId]);

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

  const hasFilters = !!(
    sportFilter ||
    areaFilter ||
    coverageFilter ||
    includePast ||
    myShiftsOnly
  );

  return {
    entries,
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
      includePast,
      setIncludePast,
      myShiftsOnly,
      setMyShiftsOnly,
      hasFilters,
      clearAll: () => {
        setSportFilter("");
        setAreaFilter("");
        setCoverageFilter("");
        setIncludePast(false);
        setMyShiftsOnly(false);
      },
    },
    calMonth,
    setCalMonth,
    currentUserId,
    currentUserRole,
    openTradeCount,
    tradeSheetOpen,
    setTradeSheetOpen,
    loadTradeCount,
    selectedGroupId,
    setSelectedGroupId,
    expandedRowId,
    setExpandedRowId,
    expandedDay,
    setExpandedDay,
  };
}
