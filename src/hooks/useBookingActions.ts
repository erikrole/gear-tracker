"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

type ActionResult = { ok: boolean; error?: string };

async function callAction(
  url: string,
  method: "POST" | "PATCH" = "POST",
  body?: unknown,
): Promise<ActionResult> {
  try {
    const res = await fetch(url, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: (json as Record<string, string>).error || "Action failed" };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, ...(json as object) };
  } catch {
    return { ok: false, error: "Network error \u2014 please try again." };
  }
}

export function useBookingActions(
  bookingId: string,
  kind: "CHECKOUT" | "RESERVATION",
  onSuccess: () => void,
) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const cancel = useCallback(async () => {
    const label = kind === "CHECKOUT" ? "checkout" : "reservation";
    const ok = await confirm({
      title: `Cancel ${label}`,
      message: `Cancel this ${label}? This action cannot be undone.`,
      confirmLabel: `Cancel ${label}`,
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading("cancel");
    const result = await callAction(`/api/bookings/${bookingId}/cancel`);
    if (result.ok) {
      onSuccess();
    } else {
      toast(result.error!, "error");
    }
    setActionLoading(null);
  }, [bookingId, kind, confirm, toast, onSuccess]);

  const extend = useCallback(
    async (endsAt: string) => {
      setActionLoading("extend");
      const result = await callAction(`/api/bookings/${bookingId}/extend`, "POST", {
        endsAt: new Date(endsAt).toISOString(),
      });
      if (result.ok) {
        onSuccess();
      } else {
        toast(result.error!, "error");
      }
      setActionLoading(null);
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
    setActionLoading("convert");
    const result = await callAction(`/api/reservations/${bookingId}/convert`);
    if (result.ok) {
      const checkoutId = (result as { data?: { id?: string } }).data?.id;
      router.push(checkoutId ? `/checkouts/${checkoutId}` : "/checkouts");
    } else {
      toast(result.error!, "error");
    }
    setActionLoading(null);
  }, [bookingId, confirm, toast, router]);

  const duplicate = useCallback(async () => {
    setActionLoading("duplicate");
    const result = await callAction(`/api/reservations/${bookingId}/duplicate`);
    if (result.ok) {
      const newId = (result as { data?: { id?: string } }).data?.id;
      router.push(newId ? `/reservations/${newId}` : "/reservations");
    } else {
      toast(result.error!, "error");
    }
    setActionLoading(null);
  }, [bookingId, toast, router]);

  const checkinItems = useCallback(
    async (assetIds: string[]) => {
      if (assetIds.length === 0) return;
      setActionLoading("checkin");
      const result = await callAction(`/api/checkouts/${bookingId}/checkin-items`, "POST", {
        assetIds,
      });
      if (result.ok) {
        onSuccess();
      } else {
        toast(result.error!, "error");
      }
      setActionLoading(null);
    },
    [bookingId, toast, onSuccess],
  );

  const checkinBulk = useCallback(
    async (bulkItemId: string, quantity: number): Promise<boolean> => {
      if (quantity <= 0) return false;
      setActionLoading(`bulk-${bulkItemId}`);
      const result = await callAction(`/api/checkouts/${bookingId}/checkin-bulk`, "POST", {
        bulkItemId,
        quantity,
      });
      if (result.ok) {
        onSuccess();
      } else {
        toast(result.error!, "error");
      }
      setActionLoading(null);
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
    setActionLoading("complete-checkin");
    const result = await callAction(`/api/checkouts/${bookingId}/complete-checkin`);
    if (result.ok) {
      onSuccess();
    } else {
      toast(result.error!, "error");
    }
    setActionLoading(null);
  }, [bookingId, confirm, toast, onSuccess]);

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    [bookingId],
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
