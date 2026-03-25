"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

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
    if (res.status === 401) {
      window.location.href = "/login";
      return { ok: false, error: "Session expired" };
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: (json as Record<string, string>).error || "Action failed" };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, ...(json as object) };
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
  const { toast } = useToast();
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
      message: `Cancel this ${label}? This action cannot be undone.`,
      confirmLabel: `Cancel ${label}`,
      variant: "danger",
    });
    if (!ok) return;
    if (!guardStart("cancel")) return;
    const result = await callAction(`/api/bookings/${bookingId}/cancel`);
    if (result.ok) {
      toast(`${label.charAt(0).toUpperCase() + label.slice(1)} cancelled`, "success");
      onSuccess();
    } else {
      toast(result.error!, "error");
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
        toast(`Extended to ${formatted}`, "success");
        onSuccess();
      } else {
        toast(result.error!, "error");
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
      const checkoutId = (result as { data?: { id?: string } }).data?.id;
      router.push(checkoutId ? `/checkouts/${checkoutId}` : "/checkouts");
    } else {
      toast(result.error!, "error");
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
      toast(result.error!, "error");
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
        toast(`${assetIds.length} item${assetIds.length > 1 ? "s" : ""} returned`, "success");
        onSuccess();
      } else {
        toast(result.error!, "error");
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
        toast("Bulk items returned", "success");
        onSuccess();
      } else {
        toast(result.error!, "error");
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
      toast("Check in completed", "success");
      onSuccess();
    } else {
      toast(result.error!, "error");
    }
    guardEnd();
  }, [bookingId, confirm, toast, onSuccess]);

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (updatedAt) headers["If-Unmodified-Since"] = new Date(updatedAt).toUTCString();
      const res = await fetchWithTimeout(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ [field]: value }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
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
    saveField,
  };
}
