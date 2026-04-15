"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DashboardData } from "@/app/(app)/dashboard-types";

export type UseDashboardFiltersResult = {
  activeSport: string | null;
  activeLocation: string | null;
  setActiveSport: (sport: string | null) => void;
  setActiveLocation: (loc: string | null) => void;
  clearFilters: () => void;
  availableSports: string[];
  availableLocations: string[];
  filtered: FilteredDashboardData | null;
  hasActiveFilter: boolean;
};

export type FilteredDashboardData = {
  myCheckouts: DashboardData["myCheckouts"]["items"];
  teamCheckouts: DashboardData["teamCheckouts"]["items"];
  teamReservations: DashboardData["teamReservations"]["items"];
  myReservations: DashboardData["myReservations"];
  upcomingEvents: DashboardData["upcomingEvents"];
  myShifts: DashboardData["myShifts"];
  overdueItems: DashboardData["overdueItems"];
};

/**
 * Dashboard filter state hook.
 * - URL-persisted sport + location filters via ?sport=MBB&location=Camp+Randall
 * - Collects available options from dashboard data
 * - Returns pre-filtered views of all sections
 * - Overdue banner intentionally excluded from filtering (safety-critical)
 */
export function useDashboardFilters(data: DashboardData | null): UseDashboardFiltersResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSport = searchParams.get("sport");
  const activeLocation = searchParams.get("location");

  const setFilterParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [searchParams, router]);

  const setActiveSport = useCallback((sport: string | null) => setFilterParam("sport", sport), [setFilterParam]);
  const setActiveLocation = useCallback((loc: string | null) => setFilterParam("location", loc), [setFilterParam]);
  const clearFilters = useCallback(() => {
    router.replace("/", { scroll: false });
  }, [router]);

  // Collect distinct sport codes from all dashboard data
  const availableSports = useMemo(() => {
    if (!data) return [];
    const codes = new Set<string>();
    for (const c of data.myCheckouts.items) if (c.sportCode) codes.add(c.sportCode);
    for (const c of data.teamCheckouts.items) if (c.sportCode) codes.add(c.sportCode);
    for (const r of data.teamReservations.items) if (r.sportCode) codes.add(r.sportCode);
    for (const r of data.myReservations) if (r.sportCode) codes.add(r.sportCode);
    for (const e of data.upcomingEvents) if (e.sportCode) codes.add(e.sportCode);
    for (const s of data.myShifts) if (s.event.sportCode) codes.add(s.event.sportCode);
    return [...codes].sort();
  }, [data]);

  // Collect distinct location names
  const availableLocations = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    for (const c of data.myCheckouts.items) if (c.locationName) names.add(c.locationName);
    for (const c of data.teamCheckouts.items) if (c.locationName) names.add(c.locationName);
    for (const r of data.teamReservations.items) if (r.locationName) names.add(r.locationName);
    for (const r of data.myReservations) if (r.locationName) names.add(r.locationName);
    for (const e of data.upcomingEvents) if (e.location) names.add(e.location);
    for (const s of data.myShifts) if (s.event.locationName) names.add(s.event.locationName);
    return [...names].sort();
  }, [data]);

  // Filter helpers
  const matchesFilters = useCallback((sportCode: string | null, locationName: string | null) => {
    const sportOk = !activeSport || sportCode === activeSport;
    const locOk = !activeLocation || locationName === activeLocation;
    return sportOk && locOk;
  }, [activeSport, activeLocation]);

  // Pre-filtered views
  const filtered = useMemo(() => {
    if (!data || (!activeSport && !activeLocation)) return null;
    return {
      myCheckouts: data.myCheckouts.items.filter((c) => matchesFilters(c.sportCode, c.locationName)),
      teamCheckouts: data.teamCheckouts.items.filter((c) => matchesFilters(c.sportCode, c.locationName)),
      teamReservations: data.teamReservations.items.filter((r) => matchesFilters(r.sportCode, r.locationName)),
      myReservations: data.myReservations.filter((r) => matchesFilters(r.sportCode, r.locationName)),
      upcomingEvents: data.upcomingEvents.filter((e) => matchesFilters(e.sportCode, e.location)),
      myShifts: data.myShifts.filter((s) => matchesFilters(s.event.sportCode, s.event.locationName)),
      overdueItems: data.overdueItems, // overdue banner always shows all — safety-critical
    };
  }, [data, activeSport, activeLocation, matchesFilters]);

  const hasActiveFilter = !!(activeSport || activeLocation);

  return {
    activeSport,
    activeLocation,
    setActiveSport,
    setActiveLocation,
    clearFilters,
    availableSports,
    availableLocations,
    filtered,
    hasActiveFilter,
  };
}
