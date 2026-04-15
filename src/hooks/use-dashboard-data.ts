"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DashboardData } from "@/app/(app)/dashboard-types";

const DASHBOARD_KEY = ["dashboard"];

/** Normalize partial API responses with safe defaults */
function normalizeDashboard(d: DashboardData): DashboardData {
  d.myCheckouts = d.myCheckouts ?? { total: 0, items: [] };
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

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    dataUpdatedAt,
    refetch,
  } = useQuery<DashboardData>({
    queryKey: DASHBOARD_KEY,
    queryFn: ({ signal }) => fetchDashboard(signal),
    staleTime: 5 * 60_000,
  });

  // Toast on background refresh failure
  const prevFetchingRef = useRef(false);
  useEffect(() => {
    if (prevFetchingRef.current && !isFetching && queryError && data !== undefined) {
      toast.error("Failed to refresh dashboard");
    }
    prevFetchingRef.current = isFetching;
  }, [isFetching, queryError, data]);

  // Classify error — only show error screen when no cached data
  const fetchError: false | "auth" | "network" | "server" =
    queryError && !data
      ? (queryError as Error).name === "TypeError" ? "network" : "server"
      : false;

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
    data: data ?? null,
    fetchError,
    refreshing: isFetching && !isLoading,
    lastRefreshed: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    loadData: () => { refetch(); },
    setData,
  };
}
