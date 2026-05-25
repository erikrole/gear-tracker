"use client";

import { useEffect, useState } from "react";
import { handleAuthRedirect, isAbortError, parseJsonSafely } from "@/lib/errors";

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
      .then(async (res) => {
        if (handleAuthRedirect(res)) return null;
        if (!res.ok) return null;
        return parseJsonSafely<{ data?: Array<{ id: string; name: string }> }>(res);
      })
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
        if (!isAbortError(err)) setKits([]);
      });
    return () => controller.abort();
  }, [locationId, open]);

  return { kits };
}
