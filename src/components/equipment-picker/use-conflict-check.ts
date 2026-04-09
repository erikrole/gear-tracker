"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

type UseConflictCheckParams = {
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  selectedAssetIds: string[];
};

/**
 * Checks for scheduling conflicts when assets are selected within a booking window.
 * Re-fires whenever selectedAssetIds, dates, or location change (debounced 400ms).
 */
export function useConflictCheck({
  startsAt,
  endsAt,
  locationId,
  selectedAssetIds,
}: UseConflictCheckParams) {
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [checking, setChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const check = useCallback(async (ids: string[], start: string, end: string, loc: string) => {
    if (ids.length === 0) { setConflicts(new Map()); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChecking(true);
    try {
      const res = await fetch("/api/availability/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: loc,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          serializedAssetIds: ids,
          bulkItems: [],
        }),
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const data = json.data as {
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
        };
        const map = new Map<string, ConflictInfo>();
        for (const c of data.conflicts ?? []) map.set(c.assetId, c);
        setConflicts(map);
      }
      // Non-OK responses: keep existing conflicts (stale > missing)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Network errors: keep existing conflicts visible
    }
    if (!abortRef.current?.signal.aborted) setChecking(false);
  }, []);

  useEffect(() => {
    if (!startsAt || !endsAt || !locationId) { setConflicts(new Map()); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      check(selectedAssetIds, startsAt, endsAt, locationId);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt, endsAt, locationId, selectedAssetIds.join(","), check]);

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return { conflicts, checking };
}
