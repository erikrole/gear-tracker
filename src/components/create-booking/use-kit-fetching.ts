"use client";

import { useCallback, useEffect, useState } from "react";
import { handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";

export function useKitFetching({
  locationId,
  open,
}: {
  locationId: string;
  open: boolean;
}) {
  const [kits, setKits] = useState<{ id: string; name: string }[]>([]);
  const [kitsLoading, setKitsLoading] = useState(false);
  const [kitsLoadError, setKitsLoadError] = useState<false | "network" | "server">(false);
  const [kitsReloadKey, setKitsReloadKey] = useState(0);
  const retryKits = useCallback(() => setKitsReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!locationId || !open) {
      setKits([]);
      setKitsLoading(false);
      setKitsLoadError(false);
      return;
    }
    const controller = new AbortController();
    setKits([]);
    setKitsLoading(true);
    setKitsLoadError(false);
    fetch(`/api/kits?location_id=${locationId}&limit=100`, { signal: controller.signal })
      .then(async (res) => {
        if (handleAuthRedirect(res)) throw new DOMException("Auth redirect", "AbortError");
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to load kits"));
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
        setKitsLoadError(false);
        setKitsLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setKits([]);
        setKitsLoadError(err instanceof TypeError ? "network" : "server");
        setKitsLoading(false);
      });
    return () => controller.abort();
  }, [locationId, open, kitsReloadKey]);

  return { kits, kitsLoading, kitsLoadError, retryKits };
}
