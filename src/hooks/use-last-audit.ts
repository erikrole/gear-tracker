import { useEffect, useState } from "react";

import { parseJsonSafely } from "@/lib/errors";

export type LastAuditInfo = {
  action: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
};

export type LastAuditMap = Record<string, LastAuditInfo>;

type LastAuditResponse = {
  data?: unknown;
};

function isLastAuditInfo(value: unknown): value is LastAuditInfo {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  const actor = entry.actor;

  return (
    typeof entry.action === "string" &&
    typeof entry.createdAt === "string" &&
    (actor === null ||
      (typeof actor === "object" &&
        typeof (actor as Record<string, unknown>).id === "string" &&
        typeof (actor as Record<string, unknown>).name === "string"))
  );
}

function isLastAuditMap(value: unknown): value is LastAuditMap {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value as Record<string, unknown>).every(isLastAuditInfo)
  );
}

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
      .then(async (res) => (res.ok ? parseJsonSafely<LastAuditResponse>(res) : null))
      .then((json) => {
        if (isLastAuditMap(json?.data)) setMap(json.data);
      })
      .catch(() => {
        // Silent — last-edited is decoration, not load-bearing.
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, key]);

  return map;
}
