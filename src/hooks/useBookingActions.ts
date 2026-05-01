"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { handleAuthRedirect, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

type ActionResult = { ok: boolean; error?: string };

async function callAction(
  url: string,
  method: "POST" | "PATCH" = "POST",
  body?: unknown,
): Promise<ActionResult> {
  try {
    const res = await fetchWithTimeout(url, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (handleAuthRedirect(res)) {
      return { ok: false, error: "Session expired" };
    }
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Action failed");
      return { ok: false, error: msg };
    }
    const json = await parseJsonSafely<object>(res);
    return { ok: true, ...(json ?? {}) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Request timed out \u2014 please try again." };
    }
    return { ok: false, error: "Network error \u2014 please try again." };
  }
}

export function useBookingActions(
  bookingId: string,
  kind: "CHECKOUT" | "RESERVATION",
  onSuccess: () => void,
  updatedAt?: string | null,
) {
  const router = useRouter();
  const confirm = useConfirm();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const busyRef = useRef(false);

  /** Synchronous ref guard — prevents double-submit across all actions */
  function guardStart(key: string): boolean {
    if (busyRef.current) return false;
    busyRef.current = true;
    setActionLoading(key);
    return true;
  }
  function guardEnd() {
    busyRef.current = false;
    setActionLoading(null);
  }

  const cancel = useCallback(async () => {
    const label = kind === "CHECKOUT" ? "checkout" : "reservation";
    const ok = await confirm({
      title: `Cancel ${label}`,
      message: `This will return all equipment to available inventory and unblock other bookings.`,
      confirmLabel: `Cancel ${label}`,
      variant: "danger",
    });
    if (!ok) return;
    if (!guardStart("cancel")) return;
    const result = await callAction(`/api/bookings/${bookingId}/cancel`);
    if (result.ok) {
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} cancelled`);
      onSuccess();
    } else {
      toast.error(result.error!);
    }
    guardEnd();
  }, [bookingId, kind, confirm, toast, onSuccess]);

  const extend = useCallback(
    async (endsAt: string) => {
      if (!guardStart("extend")) return false;
      const result = await callAction(`/api/bookings/${bookingId}/extend`, "POST", {
        endsAt: new Date(endsAt).toISOString(),
      });
      if (result.ok) {
        const d = new Date(endsAt);
        const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        toast.success(`Extended to ${formatted}`);
        onSuccess();
      } else {
        toast.error(result.error!);
      }
      guardEnd();
      return result.ok;
    },
    [bookingId, toast, onSuccess],
  );

  const convert = useCallback(async () => {
    const ok = await confirm({
      title: "Convert to checkout",
      message:
        "Convert this reservation to a checkout? The reservation will be cancelled and a new checkout created with the same items.",
      confirmLabel: "Start checkout",
    });
    if (!ok) return;
    if (!guardStart("convert")) return;
    const result = await callAction(`/api/reservations/${bookingId}/convert`);
    if (result.ok) {
      toast.success("Reservation converted to active checkout");
      const checkoutId = (result as { data?: { id?: string } }).data?.id;
      router.push(checkoutId ? `/checkouts/${checkoutId}` : "/checkouts");
    } else {
      toast.error(result.error!);
    }
    guardEnd();
  }, [bookingId, confirm, toast, router]);

  const duplicate = useCallback(async () => {
    if (!guardStart("duplicate")) return;
    const result = await callAction(`/api/reservations/${bookingId}/duplicate`);
    if (result.ok) {
      const newId = (result as { data?: { id?: string } }).data?.id;
      router.push(newId ? `/reservations/${newId}` : "/reservations");
    } else {
      toast.error(result.error!);
    }
    guardEnd();
  }, [bookingId, toast, router]);

  const checkinItems = useCallback(
    async (assetIds: string[]): Promise<boolean> => {
      if (assetIds.length === 0) return false;
      if (!guardStart("checkin")) return false;
      const result = await callAction(`/api/checkouts/${bookingId}/checkin-items`, "POST", {
        assetIds,
      });
      if (result.ok) {
        toast.success(`${assetIds.length} item${assetIds.length > 1 ? "s" : ""} returned`);
        onSuccess();
      } else {
        toast.error(result.error!);
      }
      guardEnd();
      return result.ok;
    },
    [bookingId, toast, onSuccess],
  );

  const checkinBulk = useCallback(
    async (bulkItemId: string, quantity: number): Promise<boolean> => {
      if (quantity <= 0) return false;
      if (!guardStart(`bulk-${bulkItemId}`)) return false;
      const result = await callAction(`/api/checkouts/${bookingId}/checkin-bulk`, "POST", {
        bulkItemId,
        quantity,
      });
      if (result.ok) {
        toast.success("Bulk items returned");
        onSuccess();
      } else {
        toast.error(result.error!);
      }
      guardEnd();
      return result.ok;
    },
    [bookingId, toast, onSuccess],
  );

  const completeCheckin = useCallback(async () => {
    const ok = await confirm({
      title: "Complete check in",
      message: "Complete check in? Any items not yet returned will be flagged.",
      confirmLabel: "Complete check in",
    });
    if (!ok) return;
    if (!guardStart("complete-checkin")) return;
    const result = await callAction(`/api/checkouts/${bookingId}/complete-checkin`);
    if (result.ok) {
      toast.success("Check in completed");
      onSuccess();
    } else {
      toast.error(result.error!);
    }
    guardEnd();
  }, [bookingId, confirm, toast, onSuccess]);

  const nudge = useCallback(async () => {
    if (!guardStart("nudge")) return;
    const result = await callAction(`/api/bookings/${bookingId}/nudge`);
    if (result.ok) {
      toast.success("Nudge notification sent");
    } else {
      toast.error(result.error!);
    }
    guardEnd();
  }, [bookingId, toast]);

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (updatedAt) headers["If-Unmodified-Since"] = new Date(updatedAt).toUTCString();
      const res = await fetchWithTimeout(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ [field]: value }),
      });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) {
        if (res.status === 409) throw new Error("This booking was modified by someone else. Please refresh.");
        throw new Error("Save failed");
      }
    },
    [bookingId, updatedAt],
  );

  return {
    actionLoading,
    cancel,
    extend,
    convert,
    duplicate,
    checkinItems,
    checkinBulk,
    completeCheckin,
    nudge,
    saveField,
  };
}
