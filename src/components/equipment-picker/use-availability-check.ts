"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickerAsset } from "@/components/EquipmentPicker";

type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

type UseAvailabilityCheckParams = {
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  selectedAssetIds: string[];
  legacyMode: boolean;
  legacyAssets: PickerAsset[];
  bulkSkusLength: number;
};

export function useAvailabilityCheck({
  startsAt,
  endsAt,
  locationId,
  selectedAssetIds,
  legacyMode,
  legacyAssets,
  bulkSkusLength,
}: UseAvailabilityCheckParams) {
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [bulkAvailability, setBulkAvailability] = useState<Record<string, { onHand: number; committed: number; available: number }>>({});
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsError, setConflictsError] = useState(false);
  const availDebounce = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Refs to capture current values without adding them to callback deps
  const legacyAssetsRef = useRef(legacyAssets);
  legacyAssetsRef.current = legacyAssets;
  const selectedAssetIdsRef = useRef(selectedAssetIds);
  selectedAssetIdsRef.current = selectedAssetIds;
  const bulkSkusLengthRef = useRef(bulkSkusLength);
  bulkSkusLengthRef.current = bulkSkusLength;

  const fetchConflicts = useCallback(async () => {
    if (!startsAt || !endsAt || !locationId) {
      setConflicts(new Map());
      setBulkAvailability({});
      return;
    }
    const allAssetIds = legacyMode
      ? legacyAssetsRef.current.map((a) => a.id)
      : selectedAssetIdsRef.current;

    // Skip if nothing to check
    if (allAssetIds.length === 0 && bulkSkusLengthRef.current === 0) return;

    // Abort any in-flight request to prevent stale data overwriting fresh
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setConflictsLoading(true);
    setConflictsError(false);
    try {
      const res = await fetch("/api/availability/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          serializedAssetIds: allAssetIds,
          bulkItems: [],
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data as {
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
          bulkAvailability?: Record<string, { onHand: number; committed: number; available: number }>;
        };
        const map = new Map<string, ConflictInfo>();
        if (data.conflicts) {
          for (const c of data.conflicts) {
            map.set(c.assetId, {
              assetId: c.assetId,
              conflictingBookingTitle: c.conflictingBookingTitle,
              startsAt: c.startsAt,
              endsAt: c.endsAt,
            });
          }
        }
        setConflicts(map);
        setBulkAvailability(data.bulkAvailability ?? {});
      } else {
        setConflictsError(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setConflictsError(true);
    }
    setConflictsLoading(false);
  }, [startsAt, endsAt, locationId, legacyMode]);

  useEffect(() => {
    if (availDebounce.current) clearTimeout(availDebounce.current);
    availDebounce.current = setTimeout(fetchConflicts, 500);
    return () => {
      if (availDebounce.current) clearTimeout(availDebounce.current);
      abortRef.current?.abort();
    };
  }, [fetchConflicts]);

  return { conflicts, bulkAvailability, conflictsLoading, conflictsError, fetchConflicts };
}
