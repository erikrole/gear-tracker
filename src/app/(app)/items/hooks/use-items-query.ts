"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const [loadError, setLoadError] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const reload = useCallback(async () => {
    setLoading(true);
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
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) { setLoadError(true); setLoading(false); return; }
      const json: AssetsResponse = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, deps.debouncedSearch, deps.statusKey, deps.locationKey, deps.categoryKey, deps.brandKey, deps.departmentKey, deps.showAccessories, deps.sortKey]);

  useEffect(() => { reload(); }, [reload]);

  return {
    items,
    total,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    loading,
    loadError,
    reload,
  };
}
