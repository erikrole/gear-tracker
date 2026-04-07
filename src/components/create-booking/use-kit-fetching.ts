"use client";

import { useEffect, useState } from "react";

export function useKitFetching({
  locationId,
  open,
}: {
  locationId: string;
  open: boolean;
}) {
  const [kits, setKits] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!locationId || !open) {
      setKits([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/kits?location_id=${locationId}&limit=100`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        setKits(
          (json?.data || []).map((k: { id: string; name: string }) => ({
            id: k.id,
            name: k.name,
          })),
        );
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setKits([]);
      });
    return () => controller.abort();
  }, [locationId, open]);

  return { kits };
}
