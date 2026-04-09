"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";

import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { AssetDetail } from "../types";

type UseItemActionsParams = {
  asset: AssetDetail | null;
  setAsset: React.Dispatch<React.SetStateAction<AssetDetail | null>>;
  loadAsset: () => void;
};

export type UseItemActionsReturn = {
  actionBusy: boolean;
  handleAction: (action: string) => Promise<void>;
  handleToggleFavorite: () => Promise<void>;
  saveHeaderField: (field: string, value: string) => Promise<void>;
};

export default function useItemActions({
  asset,
  setAsset,
  loadAsset,
}: UseItemActionsParams): UseItemActionsReturn {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [actionBusy, setActionBusy] = useState(false);
  const busyRef = useRef(false);

  const handleToggleFavorite = useCallback(async () => {
    if (!asset) return;
    const prev = asset.isFavorited;
    setAsset((a) => a ? { ...a, isFavorited: !prev } : a);
    try {
      const res = await fetch(`/api/assets/${asset.id}/favorite`, { method: "POST" });
      if (handleAuthRedirect(res)) return;
      if (!res.ok) throw new Error();
    } catch {
      setAsset((a) => a ? { ...a, isFavorited: prev } : a);
      toast.error("Failed to update favorite");
    }
  }, [asset, setAsset]);

  async function saveHeaderField(field: string, value: string) {
    if (!asset) return;
    const body: Record<string, unknown> = { [field]: value || null };
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (handleAuthRedirect(res)) return;
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Save failed");
      throw new Error(msg);
    }
    setAsset((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleAction(action: string) {
    if (!asset || busyRef.current) return;
    busyRef.current = true;
    setActionBusy(true);
    try {
      if (action === "print-label") {
        router.push(`/labels?items=${asset.id}`);
        busyRef.current = false;
        setActionBusy(false);
        return;
      } else if (action === "duplicate") {
        const res = await fetch(`/api/assets/${asset.id}/duplicate`, { method: "POST" });
        if (handleAuthRedirect(res)) return;
        if (res.ok) {
          const json = await res.json();
          router.push(`/items/${json.data.id}`);
        } else {
          const msg = await parseErrorMessage(res, "Duplicate failed");
          toast.error(msg);
        }
      } else if (action === "retire") {
        const ok = await confirmDialog({
          title: "Retire item",
          message: "Retire this item? It will no longer be available for bookings.",
          confirmLabel: "Retire",
          variant: "danger",
        });
        if (!ok) { busyRef.current = false; setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}/retire`, { method: "POST" });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Retire failed");
          toast.error(msg);
        }
        loadAsset();
      } else if (action === "maintenance") {
        const res = await fetch(`/api/assets/${asset.id}/maintenance`, { method: "POST" });
        if (handleAuthRedirect(res)) return;
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Action failed");
          toast.error(msg);
        }
        loadAsset();
      } else if (action === "delete") {
        const ok = await confirmDialog({
          title: "Delete item",
          message: "Permanently delete this item? This cannot be undone.",
          confirmLabel: "Delete",
          variant: "danger",
        });
        if (!ok) { busyRef.current = false; setActionBusy(false); return; }
        const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
        if (handleAuthRedirect(res)) return;
        if (res.ok) {
          router.push("/items");
        } else {
          const msg = await parseErrorMessage(res, "Delete failed");
          toast.error(msg);
        }
      }
    } catch {
      toast.error("Network error — please try again.");
    }
    busyRef.current = false;
    setActionBusy(false);
  }

  return {
    actionBusy,
    handleAction,
    handleToggleFavorite,
    saveHeaderField,
  };
}
