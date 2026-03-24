"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import type { DashboardData } from "@/app/(app)/dashboard-types";

export type UseDashboardDataResult = {
  data: DashboardData | null;
  fetchError: false | "auth" | "network" | "server";
  refreshing: boolean;
  lastRefreshed: Date | null;
  loadData: (isRefresh?: boolean) => void;
  setData: React.Dispatch<React.SetStateAction<DashboardData | null>>;
};

/**
 * Dashboard data fetching hook.
 * - AbortController race prevention
 * - Initial load vs refresh distinction (refresh keeps data visible)
 * - 401 → redirect to /login
 * - Classified error state (network / server)
 * - Last refreshed timestamp
 */
export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState<false | "auth" | "network" | "server">(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);
  // Ref for toast so loadData has zero hook deps — prevents infinite re-fetch
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadData = useCallback((isRefresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isRefresh) setRefreshing(true);
    fetch("/api/dashboard", { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) { window.location.href = "/login?returnTo=/"; return null; }
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((json) => {
        if (!json?.data) {
          if (!isRefresh) setFetchError("server");
          return;
        }
        // Defensive: ensure arrays exist even if API returns partial data
        const d = json.data as DashboardData;
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
        d.stats = d.stats ?? { checkedOut: 0, overdue: 0, reserved: 0, dueToday: 0 };
        setData(d);
        setFetchError(false);
        setLastRefreshed(new Date());
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (isRefresh) { toastRef.current("Failed to refresh dashboard", "error"); return; }
        if (err instanceof TypeError) setFetchError("network");
        else setFetchError("server");
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { loadData(); return () => { abortRef.current?.abort(); }; }, [loadData]);

  return { data, fetchError, refreshing, lastRefreshed, loadData, setData };
}
