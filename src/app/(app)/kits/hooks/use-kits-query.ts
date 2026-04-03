"use client";

import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";

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
  const [page, setPage] = useState(0);
  const limit = 25;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(page * limit));
  if (deps.search) params.set("q", deps.search);
  if (deps.locationId) params.set("location_id", deps.locationId);
  if (deps.includeArchived) params.set("include_archived", "true");
  if (deps.sortBy) params.set("sort", deps.sortBy);
  if (deps.sortOrder) params.set("order", deps.sortOrder);

  const { data, loading, refreshing, error, reload } = useFetch<KitsResponse>({
    url: `/api/kits?${params}`,
    transform: (json) => json as unknown as KitsResponse,
  });

  const kits = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    kits,
    total,
    page,
    setPage,
    limit,
    totalPages,
    loading,
    refreshing,
    loadError: !!error,
    reload,
  };
}
