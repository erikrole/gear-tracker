"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_KEY, DASHBOARD_STATS_KEY } from "@/hooks/use-dashboard-data";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";

export const BOOKING_CHANGE_SYNC_INTERVAL_MS = 5_000;
export const BOOKING_CHANGE_SYNC_EVENT = "booking-change-sync";

type BookingChangeSignal = {
  cursor: string;
  changedBookingIds: string[];
};

async function fetchBookingChanges(cursor: string | null, signal: AbortSignal): Promise<BookingChangeSignal> {
  const path = cursor
    ? `/api/bookings/changes?since=${encodeURIComponent(cursor)}`
    : "/api/bookings/changes";
  const res = await fetch(path, { signal });
  if (handleAuthRedirect(res)) throw new DOMException("Auth redirect", "AbortError");
  if (!res.ok) throw new Error("server");
  const json = await parseJsonSafely<{ data?: Partial<BookingChangeSignal> }>(res);
  const data = json?.data;
  if (!data || typeof data.cursor !== "string" || !Array.isArray(data.changedBookingIds)) {
    throw new Error("server");
  }
  return {
    cursor: data.cursor,
    changedBookingIds: data.changedBookingIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  };
}

function canPoll() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  return true;
}

export function useBookingChangeSync(enabled = true) {
  const queryClient = useQueryClient();
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearPending = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const invalidateBookingCaches = (changedBookingIds: string[]) => {
      if (changedBookingIds.length === 0) return;
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["bookingList"] });
      for (const bookingId of changedBookingIds) {
        void queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      }
      window.dispatchEvent(
        new CustomEvent(BOOKING_CHANGE_SYNC_EVENT, { detail: { changedBookingIds } }),
      );
    };

    const schedule = (delay: number) => {
      if (stopped) return;
      clearPending();
      timeout = setTimeout(() => {
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (stopped) return;
      if (!canPoll()) {
        schedule(BOOKING_CHANGE_SYNC_INTERVAL_MS);
        return;
      }
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      controller = new AbortController();
      try {
        const result = await fetchBookingChanges(cursorRef.current, controller.signal);
        cursorRef.current = result.cursor;
        invalidateBookingCaches(result.changedBookingIds);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Keep the current cursor and retry on the next scheduled tick.
        }
      } finally {
        inFlightRef.current = false;
        controller = null;
        schedule(BOOKING_CHANGE_SYNC_INTERVAL_MS);
      }
    };

    const pollSoon = () => {
      if (canPoll()) schedule(0);
    };

    document.addEventListener("visibilitychange", pollSoon);
    window.addEventListener("online", pollSoon);
    schedule(0);

    return () => {
      stopped = true;
      clearPending();
      controller?.abort();
      document.removeEventListener("visibilitychange", pollSoon);
      window.removeEventListener("online", pollSoon);
    };
  }, [enabled, queryClient]);
}
