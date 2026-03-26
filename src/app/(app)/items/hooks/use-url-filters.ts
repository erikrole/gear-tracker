"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";

export type FilterState = {
  search: string;
  debouncedSearch: string;
  statusFilter: Set<string>;
  locationFilter: Set<string>;
  categoryFilter: Set<string>;
  brandFilter: Set<string>;
  departmentFilter: Set<string>;
  sorting: SortingState;
  hasActiveFilters: boolean;
};

export type FilterActions = {
  setSearch: (value: string) => void;
  setStatusFilter: (value: Set<string>) => void;
  setLocationFilter: (value: Set<string>) => void;
  setCategoryFilter: (value: Set<string>) => void;
  setBrandFilter: (value: Set<string>) => void;
  setDepartmentFilter: (value: Set<string>) => void;
  setSorting: (value: SortingState) => void;
  clearAllFilters: () => void;
};

function readSet(params: URLSearchParams, key: string): Set<string> {
  return new Set(params.getAll(key).filter(Boolean));
}

export function useUrlFilters() {
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => readSet(searchParams, "status"));
  const [locationFilter, setLocationFilter] = useState<Set<string>>(() => readSet(searchParams, "location"));
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(() => readSet(searchParams, "category"));
  const [brandFilter, setBrandFilter] = useState<Set<string>>(() => readSet(searchParams, "brand"));
  const [departmentFilter, setDepartmentFilter] = useState<Set<string>>(() => readSet(searchParams, "department"));
  const [showAccessories, setShowAccessories] = useState(() => searchParams.get("accessories") === "1");
  const [favoritesOnly, setFavoritesOnly] = useState(() => searchParams.get("favorites") === "1");
  const [sorting, setSorting] = useState<SortingState>(() => {
    const s = searchParams.get("sort");
    const o = searchParams.get("order");
    if (s) return [{ id: s, desc: o === "desc" }];
    return [];
  });

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const hasActiveFilters =
    statusFilter.size > 0 ||
    locationFilter.size > 0 ||
    categoryFilter.size > 0 ||
    brandFilter.size > 0 ||
    departmentFilter.size > 0 ||
    favoritesOnly;

  // Sync filters to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    statusFilter.forEach((v) => params.append("status", v));
    locationFilter.forEach((v) => params.append("location", v));
    categoryFilter.forEach((v) => params.append("category", v));
    brandFilter.forEach((v) => params.append("brand", v));
    departmentFilter.forEach((v) => params.append("department", v));
    if (showAccessories) params.set("accessories", "1");
    if (favoritesOnly) params.set("favorites", "1");
    if (sorting.length > 0) {
      params.set("sort", sorting[0].id);
      if (sorting[0].desc) params.set("order", "desc");
    }
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearch, statusFilter, locationFilter, categoryFilter, brandFilter, departmentFilter, showAccessories, favoritesOnly, sorting]);

  const clearAllFilters = useCallback(() => {
    setStatusFilter(new Set());
    setLocationFilter(new Set());
    setCategoryFilter(new Set());
    setBrandFilter(new Set());
    setDepartmentFilter(new Set());
    setFavoritesOnly(false);
  }, []);

  // Stable serialized keys for dependency tracking
  const statusKey = [...statusFilter].sort().join(",");
  const locationKey = [...locationFilter].sort().join(",");
  const categoryKey = [...categoryFilter].sort().join(",");
  const brandKey = [...brandFilter].sort().join(",");
  const departmentKey = [...departmentFilter].sort().join(",");
  const sortKey = sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc}` : "";

  return {
    // State
    favoritesOnly,
    showAccessories,
    search,
    debouncedSearch,
    statusFilter,
    locationFilter,
    categoryFilter,
    brandFilter,
    departmentFilter,
    sorting,
    hasActiveFilters,
    // Serialized keys for effect dependencies
    statusKey,
    locationKey,
    categoryKey,
    brandKey,
    departmentKey,
    sortKey,
    // Actions
    setFavoritesOnly,
    setShowAccessories,
    setSearch,
    setStatusFilter,
    setLocationFilter,
    setCategoryFilter,
    setBrandFilter,
    setDepartmentFilter,
    setSorting,
    clearAllFilters,
  };
}
