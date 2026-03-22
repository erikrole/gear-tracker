"use client";

import { useState } from "react";

export function useBulkActions(getSelectedIds: () => string[], onComplete: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function execute(action: string, payload?: Record<string, string | null>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: getSelectedIds(), action, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Bulk action failed");
        setBusy(false);
        return;
      }
      setBusy(false);
      onComplete();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return { execute, busy, error };
}
