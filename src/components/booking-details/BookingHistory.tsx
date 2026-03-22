"use client";

import { formatDateTime } from "@/lib/format";
import { formatRelative, EQUIPMENT_ACTIONS, actionLabels } from "./helpers";
import type { AuditEntry, HistoryFilter } from "./types";

type Props = {
  filteredAuditLogs: AuditEntry[];
  historyFilter: HistoryFilter;
  onSetHistoryFilter: (f: HistoryFilter) => void;
  isAdmin: boolean;
  expandedDiffs: Set<string>;
  onToggleDiff: (entryId: string) => void;
};

export default function BookingHistory({
  filteredAuditLogs,
  historyFilter,
  onSetHistoryFilter,
  isAdmin,
  expandedDiffs,
  onToggleDiff,
}: Props) {
  return (
    <div className="sheet-section">
      {/* Filter chips */}
      <div className="filter-chips">
        {([["all", "All"], ["booking", "Booking changes"], ["equipment", "Equipment changes"]] as [HistoryFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`filter-chip ${historyFilter === key ? "active" : ""}`}
            onClick={() => onSetHistoryFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredAuditLogs.length === 0 ? (
        <div className="py-10 px-5 text-center text-muted-foreground">
          {historyFilter === "all" ? "No history yet" : "No matching history entries"}
        </div>
      ) : (
        filteredAuditLogs.map((entry) => (
          <div className="timeline-item" key={entry.id}>
            <div className={`timeline-dot action-${entry.action}`} />
            <div className="timeline-content">
              <div className="timeline-action">
                {actionLabels[entry.action] || entry.action}
              </div>
              <div className="timeline-meta">
                {entry.actor?.name ?? "Unknown user"} {"\u00b7"} {formatRelative(entry.createdAt)}
              </div>

              {/* Extended detail */}
              {entry.action === "extended" && entry.afterJson && typeof entry.afterJson.endsAt === "string" && (
                <div className="timeline-detail">
                  Extended to {formatDateTime(entry.afterJson.endsAt as string)}
                </div>
              )}

              {/* Updated fields */}
              {entry.action === "updated" && entry.afterJson && (
                <div className="timeline-detail">
                  {Object.keys(entry.afterJson).filter((k) => k !== "serializedAssetIds" && k !== "bulkItems").map((k) => (
                    <span key={k} className="field-tag">{k}</span>
                  ))}
                </div>
              )}

              {/* Equipment change details */}
              {EQUIPMENT_ACTIONS.has(entry.action) && (
                <div className="timeline-detail">
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

              {/* Admin-only diff toggle */}
              {isAdmin && (entry.beforeJson || entry.afterJson) && (
                <>
                  <button className="diff-toggle" onClick={() => onToggleDiff(entry.id)}>
                    {expandedDiffs.has(entry.id) ? "Hide diff" : "View diff"}
                  </button>
                  {expandedDiffs.has(entry.id) && (
                    <div className="diff-snapshot">
                      {entry.beforeJson && (
                        <div>
                          <strong>Before:</strong>{"\n"}
                          {JSON.stringify(entry.beforeJson, null, 2)}
                        </div>
                      )}
                      {entry.afterJson && (
                        <div className={entry.beforeJson ? "diff-after-section" : undefined}>
                          <strong>After:</strong>{"\n"}
                          {JSON.stringify(entry.afterJson, null, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
