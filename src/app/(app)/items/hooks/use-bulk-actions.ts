"use client";

import { useState } from "react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  move_location: "Moved",
  change_category: "Updated category for",
  retire: "Retired",
  maintenance: "Updated maintenance status for",
  delete: "Deleted",
  add_to_kit: "Added to kit:",
};

export function useBulkActions(getSelectedIds: () => string[], onComplete: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function execute(action: string, payload?: Record<string, string | null>) {
    const ids = getSelectedIds();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Bulk action failed";
        setError(msg);
        toast.error(msg);
        setBusy(false);
        return;
      }
      const label = ACTION_LABELS[action] ?? "Updated";
      toast.success(`${label} ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      setBusy(false);
      onComplete();
    } catch {
      setError("Network error");
      toast.error("Network error — bulk action failed");
      setBusy(false);
    }
  }

  return { execute, busy, error };
}
