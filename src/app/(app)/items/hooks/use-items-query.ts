"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { SortingState } from "@tanstack/react-table";
import type { Asset } from "../columns";

type QueryDeps = {
  debouncedSearch: string;
  statusKey: string;
  locationKey: string;
  categoryKey: string;
  brandKey: string;
  departmentKey: string;
  showAccessories: boolean;
  sorting: SortingState;
  sortKey: string;
};

type AssetsResponse = {
  data: Asset[];
  total: number;
  limit: number;
  offset: number;
};

export function useItemsQuery(deps: QueryDeps) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "", 10);
    return Number.isFinite(p) && p > 0 ? p : 0;
  });
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  const totalPages = Math.ceil(total / limit);

  const reload = useCallback(async () => {
    // Cancel any in-flight request to prevent stale data overwrites
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
    if (deps.debouncedSearch) params.set("q", deps.debouncedSearch);
    deps.statusKey.split(",").filter(Boolean).forEach((v) => params.append("status", v));
    deps.locationKey.split(",").filter(Boolean).forEach((v) => params.append("location_id", v));
    deps.categoryKey.split(",").filter(Boolean).forEach((v) => params.append("category_id", v));
    deps.brandKey.split(",").filter(Boolean).forEach((v) => params.append("brand", v));
    deps.departmentKey.split(",").filter(Boolean).forEach((v) => params.append("department_id", v));
    if (deps.showAccessories) params.set("show_accessories", "true");
    if (deps.sorting.length > 0) {
      params.set("sort", deps.sorting[0].id);
      if (deps.sorting[0].desc) params.set("order", "desc");
    }

    try {
      const res = await fetch(`/api/assets?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        if (isRefresh) {
          // Keep existing data visible, toast the error
          toast.error("Failed to refresh items");
        } else {
          setLoadError(true);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const json: AssetsResponse = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
      hasLoadedOnce.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isRefresh) {
        toast.error("Network error — could not refresh items");
      } else {
        setLoadError(true);
      }
    }
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, deps.debouncedSearch, deps.statusKey, deps.locationKey, deps.categoryKey, deps.brandKey, deps.departmentKey, deps.showAccessories, deps.sortKey]);

  useEffect(() => {
    reload();
    return () => { abortRef.current?.abort(); };
  }, [reload]);

  return {
    items,
    total,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    loading,
    refreshing,
    loadError,
    reload,
  };
}
