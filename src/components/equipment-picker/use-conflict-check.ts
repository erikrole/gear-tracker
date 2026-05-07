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
  assetIds: string[];
  excludeBookingId?: string;
};

/**
 * Checks scheduling conflicts for a batched set of assets within a booking window.
 * Re-fires whenever asset IDs, dates, location, or excluded booking change.
 */
export function useConflictCheck({
  startsAt,
  endsAt,
  locationId,
  assetIds,
  excludeBookingId,
}: UseConflictCheckParams) {
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [checking, setChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const check = useCallback(async (ids: string[], start: string, end: string, loc: string, excludeId?: string) => {
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
          ...(excludeId ? { excludeBookingId: excludeId } : {}),
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
      check(assetIds, startsAt, endsAt, locationId, excludeBookingId);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt, endsAt, locationId, excludeBookingId, assetIds.join(","), check]);

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return { conflicts, checking };
}
