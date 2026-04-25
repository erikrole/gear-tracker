"use client";

import { formatRelativeTime } from "@/lib/format";
import type { LastAuditInfo } from "@/hooks/use-last-audit";

/**
 * Tiny inline footer for admin surfaces — "Edited 3d ago by Erik" or similar.
 * Renders nothing when no audit info is available so it never visually
 * disrupts a row that simply hasn't been modified yet.
 */
export function LastEditedHint({
  info,
  className,
}: {
  info: LastAuditInfo | undefined;
  className?: string;
}) {
  if (!info) return null;
  const when = formatRelativeTime(info.createdAt, new Date());
  const who = info.actor?.name ?? "system";
  const verb = info.action === "created" ? "Added" : "Edited";
  return (
    <span
      className={`text-[11px] text-muted-foreground ${className ?? ""}`}
      title={`${verb} on ${new Date(info.createdAt).toLocaleString()} by ${who}`}
    >
      {verb} {when} · {who}
    </span>
  );
}
