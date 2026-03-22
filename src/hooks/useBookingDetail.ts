"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingDetail } from "@/components/booking-details/types";

export function useBookingDetail(id: string) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setError(false);
    setReloading(true);
    fetch(`/api/bookings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (json?.data) setBooking(json.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setReloading(false); });
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Optimistically patch local booking state (e.g. after inline save) */
  const patchLocal = useCallback((patch: Partial<BookingDetail>) => {
    setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return { booking, loading, reloading, error, reload, patchLocal };
}
