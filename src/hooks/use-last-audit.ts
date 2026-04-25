import { useEffect, useState } from "react";

export type LastAuditInfo = {
  action: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

export type LastAuditMap = Record<string, LastAuditInfo>;

/**
 * Fetch the most-recent audit entry for each entityId in one round trip.
 * Returns an empty map until resolved. Re-runs when `entityIds` membership
 * changes (uses the joined string as a stable identity).
 */
export function useLastAudit(entityType: string, entityIds: string[]): LastAuditMap {
  const key = entityIds.slice().sort().join(",");
  const [map, setMap] = useState<LastAuditMap>({});

  useEffect(() => {
    if (entityIds.length === 0) {
      setMap({});
      return;
    }
    const controller = new AbortController();
    fetch("/api/audit/last", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityIds }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setMap(json.data as LastAuditMap);
      })
      .catch(() => {
        // Silent — last-edited is decoration, not load-bearing.
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, key]);

  return map;
}
