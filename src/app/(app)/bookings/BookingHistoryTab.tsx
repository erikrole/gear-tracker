"use client";

import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import ActivityTimeline, {
  EQUIPMENT_ACTIONS,
  HIDDEN_AUDIT_FIELDS,
  type AuditEntry,
} from "@/components/ActivityTimeline";
import type { HistoryFilter } from "@/components/booking-details/types";

/* ── Filter chips ── */

const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booking", label: "Booking changes" },
  { key: "equipment", label: "Equipment changes" },
];

/* ── Component ── */

export default function BookingHistoryTab({
  auditLogs,
  bookingTitle,
}: {
  auditLogs: AuditEntry[];
  bookingTitle?: string;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filtered = useMemo(() => {
    let entries: AuditEntry[];
    if (filter === "all") entries = auditLogs;
    else if (filter === "equipment")
      entries = auditLogs.filter((e) => EQUIPMENT_ACTIONS.has(e.action));
    else entries = auditLogs.filter((e) => !EQUIPMENT_ACTIONS.has(e.action));

    // Pre-filter out update entries where all fields are hidden
    return entries.filter((e) => {
      if (e.action !== "updated" || !e.beforeJson || !e.afterJson) return true;
      return Object.keys(e.afterJson).some((k) => {
        if (HIDDEN_AUDIT_FIELDS.has(k)) return false;
        const b = (e.beforeJson as Record<string, unknown>)?.[k];
        const a = (e.afterJson as Record<string, unknown>)?.[k];
        return String(b ?? "") !== String(a ?? "");
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
          onValueChange={(v) => {
            if (v) setFilter(v as HistoryFilter);
          }}
          className="h-7"
        >
          {FILTER_OPTIONS.map(({ key, label }) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="h-6 text-xs px-2.5"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <Empty className="py-8 border-0">
          <EmptyDescription>
            {filter === "all"
              ? "No history yet."
              : "No matching history entries."}
          </EmptyDescription>
        </Empty>
      ) : (
        <ActivityTimeline
          entries={filtered}
          context="booking"
          entityName={bookingTitle}
        />
      )}
    </div>
  );
}
