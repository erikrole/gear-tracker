"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  favoritesOnly: boolean;
  sorting: SortingState;
  sortKey: string;
};

type StatusBreakdown = {
  available: number;
  checkedOut: number;
  reserved: number;
  maintenance: number;
  retired: number;
};

export type BulkItem = {
  id: string;
  kind: "bulk";
  name: string;
  category: string;
  unit: string;
  onHandQuantity: number;
  availableQuantity: number;
  imageUrl: string | null;
  locationName: string;
  locationId: string;
  categoryId: string | null;
  binQrCodeValue: string;
};

type AssetsResponse = {
  data: Asset[];
  bulkItems?: BulkItem[];
  total: number;
  limit: number;
  offset: number;
  statusBreakdown?: StatusBreakdown;
};

function buildUrl(page: number, limit: number, deps: QueryDeps): string {
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
  if (deps.favoritesOnly) params.set("favorites_only", "true");
  if (deps.sorting.length > 0) {
    params.set("sort", deps.sorting[0].id);
    if (deps.sorting[0].desc) params.set("order", "desc");
  }
  return `/api/assets?${params}`;
}

async function fetchAssets(url: string, signal?: AbortSignal): Promise<AssetsResponse> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("server");
  return res.json();
}

export function useItemsQuery(deps: QueryDeps) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [page, setPageState] = useState(() => {
    const p = parseInt(searchParams.get("page") ?? "", 10);
    return Number.isFinite(p) && p > 0 ? p : 0;
  });
  const [limit, setLimitState] = useState(() => {
    const l = parseInt(searchParams.get("limit") ?? "", 10);
    return Number.isFinite(l) && [10, 25, 50, 100].includes(l) ? l : 25;
  });

  // Sync page + limit into the URL alongside the filter params owned by use-url-filters.
  const setPage = useCallback((next: number) => {
    setPageState(next);
    const params = new URLSearchParams(window.location.search);
    if (next > 0) params.set("page", String(next));
    else params.delete("page");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const setLimit = useCallback((next: number) => {
    setLimitState(next);
    const params = new URLSearchParams(window.location.search);
    if (next !== 25) params.set("limit", String(next));
    else params.delete("limit");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const url = buildUrl(page, limit, deps);
  const queryKey = ["items", url];

  const { data: response, isLoading, isFetching, isError, refetch } = useQuery<AssetsResponse>({
    queryKey,
    queryFn: ({ signal }) => fetchAssets(url, signal),
    staleTime: 60_000,
  });

  // Toast on background refresh failure
  const prevFetchingRef = useRef(false);
  useEffect(() => {
    if (prevFetchingRef.current && !isFetching && isError && response !== undefined) {
      toast.error("Failed to refresh items");
    }
    prevFetchingRef.current = isFetching;
  }, [isFetching, isError, response]);

  const items = response?.data ?? [];
  const bulkItems = response?.bulkItems ?? [];
  const total = response?.total ?? 0;
  const statusBreakdown = response?.statusBreakdown ?? null;
  const totalPages = Math.ceil(total / limit);

  /** Optimistic update for items array (e.g. favorites toggle) */
  const setItems = useCallback(
    (updater: (items: Asset[]) => Asset[]) => {
      queryClient.setQueryData<AssetsResponse>(queryKey, (prev) =>
        prev ? { ...prev, data: updater(prev.data) } : prev,
      );
    },
    // queryKey changes with filters, which is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, queryClient],
  );

  return {
    items,
    bulkItems,
    setItems,
    total,
    statusBreakdown,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    loading: isLoading,
    refreshing: isFetching && !isLoading,
    loadError: isError && !response,
    reload: () => { refetch(); },
  };
}
