"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingDetail } from "@/components/booking-details/types";

export type BookingError = "not-found" | "network" | "auth" | "server" | null;

async function fetchBooking(id: string, signal?: AbortSignal): Promise<BookingDetail> {
  const res = await fetch(`/api/bookings/${id}`, { signal });
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login";
    throw new DOMException("Auth redirect", "AbortError");
  }
  if (res.status === 404) {
    const err = new Error("not-found");
    err.name = "NotFound";
    throw err;
  }
  if (!res.ok) throw new Error("server");
  const json = await res.json();
  if (!json?.data) throw new Error("server");
  return json.data as BookingDetail;
}

function classifyBookingError(err: unknown): BookingError {
  if (err instanceof Error) {
    if (err.name === "NotFound") return "not-found";
    if (err.message === "server") return "server";
  }
  if (err instanceof TypeError) return "network";
  if (err instanceof DOMException && err.name === "AbortError") return null;
  return "server";
}

export function useBookingDetail(id: string) {
  const queryClient = useQueryClient();
  const queryKey = ["booking", id];

  const { data, isLoading, isFetching, error: queryError, refetch } = useQuery<BookingDetail>({
    queryKey,
    queryFn: ({ signal }) => fetchBooking(id, signal),
    refetchOnWindowFocus: true,
  });

  /** Optimistically patch local booking state (e.g. after inline save) */
  const patchLocal = useCallback(
    (patch: Partial<BookingDetail>) => {
      queryClient.setQueryData<BookingDetail>(queryKey, (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
    },
    // queryKey is stable for a given id
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, queryClient],
  );

  return {
    booking: data ?? null,
    loading: isLoading,
    reloading: isFetching && !isLoading,
    error: queryError ? classifyBookingError(queryError) : null,
    reload: () => { refetch(); },
    patchLocal,
  };
}
