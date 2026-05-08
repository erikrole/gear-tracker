"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConflictInfo = {
  assetId: string;
  conflictingBookingTitle?: string;
  startsAt: string;
  endsAt: string;
};

export type UpcomingCommitmentInfo = {
  assetId: string;
  bookingId: string;
  bookingTitle?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  nextLocationId?: string | null;
  nextLocationName?: string | null;
};

export type TurnaroundRiskInfo = {
  assetId: string;
  code: "SHORT_TURNAROUND" | "LOCATION_TRANSFER" | "RECENT_CHECKIN_REPORT";
  severity: "warning" | "critical";
  message: string;
  bookingId?: string;
  bookingTitle?: string;
  startsAt?: string;
  gapMinutes?: number;
  nextLocationName?: string | null;
  reportType?: "DAMAGED" | "LOST";
  reportCreatedAt?: string;
};

export type BulkTurnaroundRiskInfo = {
  bulkSkuId: string;
  code: "BULK_SHORT_TURNAROUND";
  severity: "warning";
  message: string;
  bookingId: string;
  bookingTitle?: string;
  startsAt: string;
  gapMinutes: number;
  plannedQuantity: number;
};

type UseConflictCheckParams = {
  startsAt?: string;
  endsAt?: string;
  locationId?: string;
  assetIds: string[];
  bulkItems?: Array<{ bulkSkuId: string; quantity: number }>;
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
  bulkItems = [],
  excludeBookingId,
}: UseConflictCheckParams) {
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [upcomingCommitments, setUpcomingCommitments] = useState<Map<string, UpcomingCommitmentInfo>>(new Map());
  const [turnaroundRisks, setTurnaroundRisks] = useState<Map<string, TurnaroundRiskInfo[]>>(new Map());
  const [bulkTurnaroundRisks, setBulkTurnaroundRisks] = useState<Map<string, BulkTurnaroundRiskInfo[]>>(new Map());
  const [checking, setChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const check = useCallback(async (
    ids: string[],
    bulk: Array<{ bulkSkuId: string; quantity: number }>,
    start: string,
    end: string,
    loc: string,
    excludeId?: string,
  ) => {
    if (ids.length === 0 && bulk.length === 0) {
      setConflicts(new Map());
      setUpcomingCommitments(new Map());
      setTurnaroundRisks(new Map());
      setBulkTurnaroundRisks(new Map());
      return;
    }
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
          bulkItems: bulk,
          ...(excludeId ? { excludeBookingId: excludeId } : {}),
        }),
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        const json = await res.json();
        const data = json.data as {
          conflicts?: Array<{ assetId: string; conflictingBookingTitle?: string; startsAt: string; endsAt: string }>;
          upcomingCommitments?: UpcomingCommitmentInfo[];
          turnaroundRisks?: TurnaroundRiskInfo[];
          bulkTurnaroundRisks?: BulkTurnaroundRiskInfo[];
        };
        const conflictMap = new Map<string, ConflictInfo>();
        for (const c of data.conflicts ?? []) conflictMap.set(c.assetId, c);
        const upcomingMap = new Map<string, UpcomingCommitmentInfo>();
        for (const c of data.upcomingCommitments ?? []) upcomingMap.set(c.assetId, c);
        const riskMap = new Map<string, TurnaroundRiskInfo[]>();
        for (const risk of data.turnaroundRisks ?? []) {
          riskMap.set(risk.assetId, [...(riskMap.get(risk.assetId) ?? []), risk]);
        }
        const bulkRiskMap = new Map<string, BulkTurnaroundRiskInfo[]>();
        for (const risk of data.bulkTurnaroundRisks ?? []) {
          bulkRiskMap.set(risk.bulkSkuId, [...(bulkRiskMap.get(risk.bulkSkuId) ?? []), risk]);
        }
        setConflicts(conflictMap);
        setUpcomingCommitments(upcomingMap);
        setTurnaroundRisks(riskMap);
        setBulkTurnaroundRisks(bulkRiskMap);
      }
      // Non-OK responses: keep existing availability context (stale > missing)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Network errors: keep existing availability context visible
    }
    if (!abortRef.current?.signal.aborted) setChecking(false);
  }, []);

  useEffect(() => {
    if (!startsAt || !endsAt || !locationId) {
      setConflicts(new Map());
      setUpcomingCommitments(new Map());
      setTurnaroundRisks(new Map());
      setBulkTurnaroundRisks(new Map());
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      check(assetIds, bulkItems, startsAt, endsAt, locationId, excludeBookingId);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt, endsAt, locationId, excludeBookingId, assetIds.join(","), JSON.stringify(bulkItems), check]);

  // Abort on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return { conflicts, upcomingCommitments, turnaroundRisks, bulkTurnaroundRisks, checking };
}
