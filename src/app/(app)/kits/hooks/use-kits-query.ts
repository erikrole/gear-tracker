"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type KitRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  location: { id: string; name: string };
  _count: { members: number };
};

type KitsResponse = {
  data: KitRow[];
  total: number;
  limit: number;
  offset: number;
};

type QueryDeps = {
  search: string;
  locationId: string;
  includeArchived: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

export function useKitsQuery(deps: QueryDeps) {
  const [kits, setKits] = useState<KitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  const totalPages = Math.ceil(total / limit);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isRefresh = hasLoadedOnce.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(false);

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (deps.search) params.set("q", deps.search);
    if (deps.locationId) params.set("location_id", deps.locationId);
    if (deps.includeArchived) params.set("include_archived", "true");
    if (deps.sortBy) params.set("sort", deps.sortBy);
    if (deps.sortOrder) params.set("order", deps.sortOrder);

    try {
      const res = await fetch(`/api/kits?${params}`, { signal: controller.signal });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to load kits");
      }
      const json: KitsResponse = await res.json();
      if (controller.signal.aborted) return;
      setKits(json.data);
      setTotal(json.total);
      hasLoadedOnce.current = true;
      setLoadError(false);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (hasLoadedOnce.current) {
        // Keep stale data on refresh failure
      } else {
        setLoadError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [deps.search, deps.locationId, deps.includeArchived, deps.sortBy, deps.sortOrder, page, limit]);

  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  return { kits, total, page, setPage, limit, totalPages, loading, refreshing, loadError, reload };
}
