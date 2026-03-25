"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/format";
import {
  formatRelative,
  actionLabels,
  EQUIPMENT_ACTIONS,
  HIDDEN_AUDIT_FIELDS,
  ID_AUDIT_FIELDS,
} from "@/components/booking-details/helpers";
import type { AuditEntry, HistoryFilter } from "@/components/booking-details/types";

/* ── Field change description (follows ItemHistoryTab pattern) ── */

function describeFieldChange(
  key: string,
  before: unknown,
  after: unknown,
): { label: string; from: string; to: string } | null {
  if (HIDDEN_AUDIT_FIELDS.has(key)) return null;

  const labels: Record<string, string> = {
    title: "Title",
    notes: "Notes",
    status: "Status",
    startsAt: "Start date",
    endsAt: "End date",
    locationId: "Location",
    requesterUserId: "Requester",
    serializedAssetIds: "Equipment",
    bulkItems: "Bulk items",
  };
  const label = labels[key] || key;

  if (ID_AUDIT_FIELDS.has(key)) {
    const hadBefore = before != null && before !== "";
    const hasAfter = after != null && after !== "";
    if (!hadBefore && hasAfter) return { label, from: "", to: "set" };
    if (hadBefore && !hasAfter) return { label, from: "", to: "removed" };
    return { label, from: "", to: "changed" };
  }

  if (typeof after === "boolean" || after === "true" || after === "false") {
    return { label, from: "", to: String(after) === "true" ? "enabled" : "disabled" };
  }

  // Skip array fields in generic diff (shown via equipment actions)
  if (Array.isArray(before) || Array.isArray(after)) return null;

  const from = before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  if (from === to) return null;
  return { label, from, to };
}

/* ── Filter chips ── */

const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booking", label: "Booking changes" },
  { key: "equipment", label: "Equipment changes" },
];

/* ── Component ── */

export default function BookingHistoryTab({
  auditLogs,
}: {
  auditLogs: AuditEntry[];
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filtered = useMemo(() => {
    let entries: AuditEntry[];
    if (filter === "all") entries = auditLogs;
    else if (filter === "equipment") entries = auditLogs.filter((e) => EQUIPMENT_ACTIONS.has(e.action));
    else entries = auditLogs.filter((e) => !EQUIPMENT_ACTIONS.has(e.action));
    // Pre-filter out update entries where all fields are hidden (would render as null)
    return entries.filter((e) => {
      if (e.action !== "updated" || !e.beforeJson || !e.afterJson) return true;
      return Object.keys(e.afterJson).some((k) => {
        const b = (e.beforeJson as Record<string, unknown>)?.[k];
        const a = (e.afterJson as Record<string, unknown>)?.[k];
        return describeFieldChange(k, b, a) !== null;
      });
    });
  }, [auditLogs, filter]);

  return (
    <div>
      {/* Filter chips */}
      <div className="px-3 py-2.5 border-b border-border/30">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => { if (v) setFilter(v as HistoryFilter); }}
          className="h-7"
        >
          {FILTER_OPTIONS.map(({ key, label }) => (
            <ToggleGroupItem key={key} value={key} className="h-6 text-xs px-2.5">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <Empty className="py-8 border-0">
          <EmptyDescription>
            {filter === "all" ? "No history yet." : "No matching history entries."}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col divide-y divide-border/40">
          {filtered.map((entry) => {
            const SYSTEM_ACTIONS = new Set(["auto_escalation", "cron_notification", "auto_complete"]);
            const actorName = entry.actor?.name
              ?? (SYSTEM_ACTIONS.has(entry.action) ? "System" : "Deleted user");
            const initial = actorName.slice(0, 1).toUpperCase();
            const label = actionLabels[entry.action] || entry.action;
            const isUpdate = entry.action === "updated" && entry.beforeJson && entry.afterJson;
            const isEquipment = EQUIPMENT_ACTIONS.has(entry.action);

            // Compute field-level changes for update entries
            const changes = isUpdate
              ? Object.keys(entry.afterJson!)
                  .map((k) => {
                    const b = (entry.beforeJson as Record<string, unknown>)?.[k];
                    const a = (entry.afterJson as Record<string, unknown>)?.[k];
                    return describeFieldChange(k, b, a);
                  })
                  .filter((c): c is NonNullable<typeof c> => c !== null)
              : [];

            return (
              <div
                className="flex gap-2.5 items-start px-3 py-2 first:pt-2 last:pb-2"
                key={entry.id}
              >
                <Avatar
                  className={`size-7 text-xs shrink-0 mt-0.5 ${
                    isEquipment
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : ""
                  }`}
                >
                  <AvatarFallback
                    className={
                      isEquipment
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : ""
                    }
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">{actorName}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">
                      {formatRelative(entry.createdAt)}
                      {" · "}
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>

                  {/* Extended detail */}
                  {entry.action === "extended" &&
                    entry.afterJson &&
                    typeof entry.afterJson.endsAt === "string" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Extended to {formatDateTime(entry.afterJson.endsAt as string)}
                      </div>
                    )}

                  {/* Field-level changes for updates */}
                  {changes.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {changes.map((change) => (
                        <div
                          key={change.label}
                          className="text-xs text-muted-foreground flex items-center gap-1.5"
                        >
                          <span className="font-medium text-foreground/70">
                            {change.label}
                          </span>
                          {change.from ? (
                            <>
                              <span className="line-through opacity-50">
                                {change.from}
                              </span>
                              <span className="text-muted-foreground/50">
                                {"\u2192"}
                              </span>
                              <span>{change.to}</span>
                            </>
                          ) : (
                            <span>{change.to}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Equipment change details */}
                  {isEquipment && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.action === "booking.items_added" && entry.afterJson && (
                        <span>
                          {Array.isArray(entry.afterJson.serializedAssetIds)
                            ? `${(entry.afterJson.serializedAssetIds as string[]).length} serialized item(s) `
                            : ""}
                          {Array.isArray(entry.afterJson.bulkItems)
                            ? `${(entry.afterJson.bulkItems as unknown[]).length} bulk item(s)`
                            : ""}
                        </span>
                      )}
                      {entry.action === "booking.items_removed" && entry.beforeJson && (
                        <span>
                          {Array.isArray(entry.beforeJson.serializedAssetIds)
                            ? `${(entry.beforeJson.serializedAssetIds as string[]).length} serialized item(s) `
                            : ""}
                          {Array.isArray(entry.beforeJson.bulkItems)
                            ? `${(entry.beforeJson.bulkItems as unknown[]).length} bulk item(s)`
                            : ""}
                        </span>
                      )}
                      {entry.action === "booking.items_qty_changed" && (
                        <span>Quantities updated</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
