"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingDetail } from "@/components/booking-details/types";

export type BookingError = "not-found" | "network" | "auth" | "server" | null;

export function useBookingDetail(id: string) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<BookingError>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBooking = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`/api/bookings/${id}`, { signal });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return null;
        }
        if (res.status === 404) return "not-found" as const;
        return "server" as const;
      }
      const json = await res.json();
      return json?.data ? (json.data as BookingDetail) : ("server" as const);
    },
    [id],
  );

  const reload = useCallback(async () => {
    // Abort any in-flight request to prevent stale data
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isInitial = !booking;
    if (isInitial) setLoading(true);
    else setReloading(true);
    setError(null);

    try {
      const result = await fetchBooking(controller.signal);
      if (controller.signal.aborted) return;
      if (result === null) return; // auth redirect
      if (typeof result === "string") {
        // Only show error screen if no data to preserve
        if (isInitial) setError(result);
        // On reload failure, keep existing data visible (toast handled by caller)
      } else {
        setBooking(result);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isInitial) setError("network");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setReloading(false);
      }
    }
  }, [booking, fetchBooking]);

  // Use a stable ref for reload to avoid re-triggering useEffect when booking changes
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    reloadRef.current();
    return () => abortRef.current?.abort();
  }, [id]);

  /** Optimistically patch local booking state (e.g. after inline save) */
  const patchLocal = useCallback((patch: Partial<BookingDetail>) => {
    setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return { booking, loading, reloading, error, reload, patchLocal };
}
