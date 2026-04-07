"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";
import type { PickerAsset } from "@/components/EquipmentPicker";

type UsePickerSearchParams = {
  legacyMode: boolean;
  activeSection: EquipmentSectionKey;
  equipSearch: string;
  onlyAvailable: boolean;
  globalSearch: string;
};

export function usePickerSearch({
  legacyMode,
  activeSection,
  equipSearch,
  onlyAvailable,
  globalSearch,
}: UsePickerSearchParams) {
  const [sectionResults, setSectionResults] = useState<PickerAsset[]>([]);
  const [apiSectionCounts, setApiSectionCounts] = useState<Record<EquipmentSectionKey, number>>({
    cameras: 0, lenses: 0, batteries: 0, accessories: 0, others: 0,
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchApiResults, setGlobalSearchApiResults] = useState<PickerAsset[]>([]);
  const searchAbortRef = useRef<AbortController | null>(null);
  const globalSearchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const globalSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const initialFetchDoneRef = useRef(false);

  // ── Search mode: fetch section results from API ──
  const fetchSectionResults = useCallback(async (section: EquipmentSectionKey, q: string, available: boolean) => {
    if (legacyMode) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("section", section);
      if (q) params.set("q", q);
      params.set("only_available", String(available));
      params.set("limit", "50");
      const res = await fetch(`/api/assets/picker-search?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const data = json.data as { assets: PickerAsset[]; total: number; sectionCounts: Record<string, number> | null };
        setSectionResults(data.assets);
        if (data.sectionCounts) {
          setApiSectionCounts(data.sectionCounts as Record<EquipmentSectionKey, number>);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    if (!controller.signal.aborted) setSearchLoading(false);
  }, [legacyMode]);

  // Trigger search on section change, search text change, or onlyAvailable change
  useEffect(() => {
    if (legacyMode) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchSectionResults(activeSection, equipSearch, onlyAvailable);
    }, initialFetchDoneRef.current ? 300 : 0);
    initialFetchDoneRef.current = true;
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [legacyMode, activeSection, equipSearch, onlyAvailable, fetchSectionResults]);

  // ── Search mode: global search API call ──
  const fetchGlobalSearchResults = useCallback(async (q: string, available: boolean) => {
    if (legacyMode) return;
    globalSearchAbortRef.current?.abort();
    if (!q.trim()) {
      setGlobalSearchApiResults([]);
      setGlobalSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    globalSearchAbortRef.current = controller;
    setGlobalSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", q.trim());
      params.set("only_available", String(available));
      params.set("limit", "30");
      const res = await fetch(`/api/assets/picker-search?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const data = json.data as { assets: PickerAsset[]; total: number; sectionCounts: Record<string, number> | null };
        setGlobalSearchApiResults(data.assets);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    if (!controller.signal.aborted) setGlobalSearchLoading(false);
  }, [legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    if (globalSearchDebounceRef.current) clearTimeout(globalSearchDebounceRef.current);
    globalSearchDebounceRef.current = setTimeout(() => {
      fetchGlobalSearchResults(globalSearch, onlyAvailable);
    }, 300);
    return () => {
      if (globalSearchDebounceRef.current) clearTimeout(globalSearchDebounceRef.current);
    };
  }, [legacyMode, globalSearch, onlyAvailable, fetchGlobalSearchResults]);

  // Cleanup search abort controllers on unmount
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      globalSearchAbortRef.current?.abort();
    };
  }, []);

  return { sectionResults, apiSectionCounts, searchLoading, globalSearchApiResults, globalSearchLoading };
}
