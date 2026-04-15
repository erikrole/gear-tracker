"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DashboardData, DashboardStats } from "@/app/(app)/dashboard-types";

export const DASHBOARD_KEY = ["dashboard"];
export const DASHBOARD_STATS_KEY = ["dashboard-stats"];

/** Normalize partial API responses with safe defaults */
function normalizeDashboard(d: DashboardData): DashboardData {
  d.myCheckouts = d.myCheckouts ?? { total: 0, overdue: 0, items: [] };
  d.myCheckouts.overdue = d.myCheckouts.overdue ?? 0;
  d.myCheckouts.items = d.myCheckouts.items ?? [];
  d.teamCheckouts = d.teamCheckouts ?? { total: 0, overdue: 0, items: [] };
  d.teamCheckouts.items = d.teamCheckouts.items ?? [];
  d.teamReservations = d.teamReservations ?? { total: 0, items: [] };
  d.teamReservations.items = d.teamReservations.items ?? [];
  d.upcomingEvents = d.upcomingEvents ?? [];
  d.myReservations = d.myReservations ?? [];
  d.overdueItems = d.overdueItems ?? [];
  d.drafts = d.drafts ?? [];
  d.myShifts = d.myShifts ?? [];
  d.flaggedItems = d.flaggedItems ?? [];
  d.lostBulkUnits = d.lostBulkUnits ?? [];
  d.stats = d.stats ?? { checkedOut: 0, overdue: 0, reserved: 0, dueToday: 0 };
  return d;
}

async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const res = await fetch("/api/dashboard", { signal });
  if (res.status === 401) {
    window.location.href = "/login?returnTo=/";
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!res.ok) throw new Error("server");
  const json = await res.json();
  if (!json?.data) throw new Error("server");
  return normalizeDashboard(json.data as DashboardData);
}

async function fetchDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats", { signal });
  if (res.status === 401) {
    window.location.href = "/login?returnTo=/";
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (!res.ok) throw new Error("server");
  const json = await res.json();
  if (!json?.data) throw new Error("server");
  return json.data as DashboardStats;
}

export type UseDashboardDataResult = {
  data: DashboardData | null;
  fetchError: false | "auth" | "network" | "server";
  refreshing: boolean;
  lastRefreshed: Date | null;
  loadData: () => void;
  setData: React.Dispatch<React.SetStateAction<DashboardData | null>>;
};

export function useDashboardData(): UseDashboardDataResult {
  const queryClient = useQueryClient();

  // Full payload — heavy queries, 5-minute stale time
  const {
    data: fullData,
    isLoading,
    isFetching,
    error: fullError,
    dataUpdatedAt,
    refetch: refetchFull,
  } = useQuery<DashboardData>({
    queryKey: DASHBOARD_KEY,
    queryFn: ({ signal }) => fetchDashboard(signal),
    staleTime: 5 * 60_000,
  });

  // Fast stats — single SQL query, 60-second stale time, refetch on window focus
  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: DASHBOARD_STATS_KEY,
    queryFn: ({ signal }) => fetchDashboardStats(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    // Only run once we have the full data — no need to race on first load
    enabled: fullData !== undefined,
  });

  // Toast on background refresh failure (full payload only)
  const prevFetchingRef = useRef(false);
  useEffect(() => {
    if (prevFetchingRef.current && !isFetching && fullError && fullData !== undefined) {
      toast.error("Failed to refresh dashboard");
    }
    prevFetchingRef.current = isFetching;
  }, [isFetching, fullError, fullData]);

  // Classify error — only show error screen when no cached data
  const fetchError: false | "auth" | "network" | "server" =
    fullError && !fullData
      ? (fullError as Error).name === "TypeError" ? "network" : "server"
      : false;

  // Merge: overlay fresh stats from the fast endpoint onto the full payload.
  // This keeps stat cards and the overdue count current (60s) without
  // re-running the expensive events/shifts/flagged queries.
  const data: DashboardData | null = fullData
    ? statsData
      ? {
          ...fullData,
          stats: statsData.stats,
          overdueCount: statsData.overdueCount,
          myCheckouts: {
            ...fullData.myCheckouts,
            total: statsData.myCheckoutsTotal,
            overdue: statsData.myOverdueCount,
          },
          teamCheckouts: {
            ...fullData.teamCheckouts,
            total: statsData.teamCheckoutsTotal,
            overdue: statsData.teamCheckoutsOverdue,
          },
          teamReservations: {
            ...fullData.teamReservations,
            total: statsData.teamReservationsTotal,
          },
        }
      : fullData
    : null;

  // Preserve setData API for optimistic updates (draft deletion)
  const setData: React.Dispatch<React.SetStateAction<DashboardData | null>> = useCallback(
    (updater) => {
      queryClient.setQueryData<DashboardData>(DASHBOARD_KEY, (prev) => {
        if (typeof updater === "function") {
          return updater(prev ?? null) ?? undefined;
        }
        return updater ?? undefined;
      });
    },
    [queryClient],
  );

  return {
    data,
    fetchError,
    refreshing: isFetching && !isLoading,
    lastRefreshed: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loadData: () => { refetchFull(); },
    setData,
  };
}
