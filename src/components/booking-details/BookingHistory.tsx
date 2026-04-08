"use client";

import { formatDateTime } from "@/lib/format";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative, EQUIPMENT_ACTIONS, actionLabels } from "./helpers";
import { cn } from "@/lib/utils";
import type { AuditEntry, HistoryFilter } from "./types";

const TIMELINE_DOT_COLORS: Record<string, string> = {
  created: "bg-green-500",
  create: "bg-green-500",
  updated: "bg-blue-500",
  update: "bg-blue-500",
  extended: "bg-purple-500",
  extend: "bg-purple-500",
  cancelled: "bg-red-500",
  cancel: "bg-red-500",
  checkin_completed: "bg-green-500",
  cancelled_by_checkout_conversion: "bg-blue-500",
  "booking.items_added": "bg-green-500",
  "booking.items_removed": "bg-red-500",
  "booking.items_qty_changed": "bg-orange-500",
};

type Props = {
  filteredAuditLogs: AuditEntry[];
  historyFilter: HistoryFilter;
  onSetHistoryFilter: (f: HistoryFilter) => void;
  isAdmin: boolean;
  expandedDiffs: Set<string>;
  onToggleDiff: (entryId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export default function BookingHistory({
  filteredAuditLogs,
  historyFilter,
  onSetHistoryFilter,
  isAdmin,
  expandedDiffs,
  onToggleDiff,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  return (
    <div>
      {/* Filter chips */}
      <div className="mb-3">
        <ToggleGroup
          type="single"
          value={historyFilter}
          onValueChange={(v) => { if (v) onSetHistoryFilter(v as HistoryFilter); }}
          className="h-8"
        >
          <ToggleGroupItem value="all" className="h-7 text-xs px-3">All</ToggleGroupItem>
          <ToggleGroupItem value="booking" className="h-7 text-xs px-3">Booking changes</ToggleGroupItem>
          <ToggleGroupItem value="equipment" className="h-7 text-xs px-3">Equipment changes</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredAuditLogs.length === 0 ? (
        <div className="py-10 px-5 text-center text-muted-foreground">
          {historyFilter === "all" ? "No history yet" : "No matching history entries"}
        </div>
      ) : (
        <>
          {filteredAuditLogs.map((entry) => (
            <div className="flex gap-3 py-2" key={entry.id}>
              <div
                className={cn(
                  "size-2 rounded-full mt-1.5 shrink-0",
                  TIMELINE_DOT_COLORS[entry.action] || "bg-border"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {actionLabels[entry.action] || entry.action}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {entry.actor?.name ?? "Unknown user"} {"\u00b7"} {formatRelative(entry.createdAt)}
                </div>

                {/* Extended detail */}
                {entry.action === "extended" && entry.afterJson && typeof entry.afterJson.endsAt === "string" && (
                  <div className="text-xs text-muted-foreground mt-1 bg-muted px-2.5 py-1.5 rounded-md">
                    Extended to {formatDateTime(entry.afterJson.endsAt as string)}
                  </div>
                )}

                {/* Updated fields */}
                {entry.action === "updated" && entry.afterJson && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {Object.keys(entry.afterJson).filter((k) => k !== "serializedAssetIds" && k !== "bulkItems").map((k) => (
                      <Badge key={k} variant="gray" size="sm">{k}</Badge>
                    ))}
                  </div>
                )}

                {/* Equipment change details */}
                {EQUIPMENT_ACTIONS.has(entry.action) && (
                  <div className="text-xs text-muted-foreground mt-1 bg-muted px-2.5 py-1.5 rounded-md">
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
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 decoration-dotted mt-1"
                      onClick={() => onToggleDiff(entry.id)}
                    >
                      {expandedDiffs.has(entry.id) ? "Hide diff" : "View diff"}
                    </button>
                    {expandedDiffs.has(entry.id) && (
                      <ScrollArea className="text-xs font-mono bg-muted px-2.5 py-2 rounded-md mt-1 whitespace-pre-wrap break-words max-h-[200px]">
                        {entry.beforeJson && (
                          <div>
                            <strong>Before:</strong>{"\n"}
                            {JSON.stringify(entry.beforeJson, null, 2)}
                          </div>
                        )}
                        {entry.afterJson && (
                          <div className={entry.beforeJson ? "mt-2" : undefined}>
                            <strong>After:</strong>{"\n"}
                            {JSON.stringify(entry.afterJson, null, 2)}
                          </div>
                        )}
                      </ScrollArea>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {hasMore && onLoadMore && (
            <div className="py-3 text-center">
              <Button variant="outline" size="sm" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? "Loading\u2026" : "Load older entries"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
