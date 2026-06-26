"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SortingState } from "@tanstack/react-table";
import type { Asset } from "../columns";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import type { ItemTypeFilter } from "./use-url-filters";

type QueryDeps = {
  debouncedSearch: string;
  itemType: ItemTypeFilter;
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
  pendingPickup: number;
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
  trackByNumber: boolean;
  onHandQuantity: number;
  availableQuantity: number;
  checkedOutQuantity: number;
  lostQuantity: number;
  retiredQuantity: number;
  matchedUnitNumber?: number;
  matchedUnitStatus?: string;
  matchedUnitHolder?: string | null;
  matchedUnitDueAt?: string | null;
  matchedUnitBookingTitle?: string | null;
  imageUrl: string | null;
  locationName: string;
  locationId: string;
  categoryId: string | null;
  departmentId: string | null;
  departmentName: string | null;
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

function parsePageParam(raw: string | null): number {
  const page = parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 0;
}

function parseLimitParam(raw: string | null): number {
  const limit = parseInt(raw ?? "", 10);
  return Number.isFinite(limit) && [10, 25, 50, 100].includes(limit) ? limit : 25;
}

function buildUrl(page: number, limit: number, deps: QueryDeps): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(page * limit));
  if (deps.itemType !== "all") params.set("item_type", deps.itemType);
  if (deps.debouncedSearch) params.set("q", deps.debouncedSearch);
  deps.statusKey.split(",").filter(Boolean).forEach((v) => params.append("status", v));
  deps.locationKey.split(",").filter(Boolean).forEach((v) => params.append("location_id", v));
  deps.categoryKey.split(",").filter(Boolean).forEach((v) => params.append("category_id", v));
  deps.brandKey.split(",").filter(Boolean).forEach((v) => params.append("brand", v));
  deps.departmentKey.split(",").filter(Boolean).forEach((v) => params.append("department_id", v));
  if (deps.showAccessories) params.set("show_accessories", "true");
  if (deps.favoritesOnly) params.set("favorites_only", "true");
  if (deps.sorting.length > 0) {
    params.set("sort", deps.sorting[0]!.id);
    if (deps.sorting[0]!.desc) params.set("order", "desc");
  }
  return `/api/assets?${params}`;
}

async function fetchAssets(url: string, signal?: AbortSignal): Promise<AssetsResponse> {
  const res = await fetch(url, { signal });
  if (handleAuthRedirect(res, "/items")) {
    throw new DOMException("Session expired", "AbortError");
  }
  if (!res.ok) throw new Error("server");
  const json = await parseJsonSafely<AssetsResponse>(res);
  if (!json || !Array.isArray(json.data) || typeof json.total !== "number") {
    throw new Error("server");
  }
  return {
    ...json,
    bulkItems: Array.isArray(json.bulkItems) ? json.bulkItems : [],
  };
}

export function useItemsQuery(deps: QueryDeps) {
  const searchParams = useSearchParams();
  const searchSignature = searchParams.toString();
  const lastObservedSearchSignatureRef = useRef(searchSignature);
  const queryClient = useQueryClient();

  const [page, setPageState] = useState(() => parsePageParam(searchParams.get("page")));
  const [limit, setLimitState] = useState(() => parseLimitParam(searchParams.get("limit")));

  useEffect(() => {
    if (lastObservedSearchSignatureRef.current === searchSignature) return;
    lastObservedSearchSignatureRef.current = searchSignature;

    const nextPage = parsePageParam(searchParams.get("page"));
    const nextLimit = parseLimitParam(searchParams.get("limit"));
    setPageState((current) => (current === nextPage ? current : nextPage));
    setLimitState((current) => (current === nextLimit ? current : nextLimit));
  }, [searchParams, searchSignature]);

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
      queryClient.setQueryData<AssetsResponse>(["items", url], (prev) =>
        prev ? { ...prev, data: updater(prev.data) } : prev,
      );
    },
    [url, queryClient],
  );

  // Invalidate every cached filter combination, not just the active one. A
  // favorite (or bulk mutation) changes data that other cached filter views
  // also depend on; without this they keep serving stale rows within
  // `staleTime` when the user toggles a filter back. `refetchActive: false`
  // leaves the current view's optimistic state untouched (no flicker) while
  // marking siblings stale so they refetch when next viewed.
  const invalidate = useCallback(
    (refetchActive: boolean) => {
      queryClient.invalidateQueries({
        queryKey: ["items"],
        refetchType: refetchActive ? "active" : "none",
      });
    },
    [queryClient],
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
    invalidate,
  };
}
