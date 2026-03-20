"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";

/* ── Types ──────────────────────────────────────────────── */

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created this item",
  updated: "Updated item details",
  deleted: "Deleted this item",
  retired: "Retired this item",
  marked_maintenance: "Marked as needs maintenance",
  cleared_maintenance: "Cleared maintenance status",
  duplicated: "Duplicated this item",
  qr_generated: "Generated new QR code",
  // Booking actions
  "booking.created": "Created a booking",
  cancelled: "Cancelled booking",
  cancelled_by_checkout_conversion: "Reservation converted to checkout",
  items_returned: "All items returned",
  items_returned_partial: "Some items returned",
  checkout_completed: "Checkout completed",
  extended: "Extended checkout",
  partial_return_recorded: "Partial return recorded",
  checkout_scan_completed: "Checkout scan completed",
  scan_completed: "Scan completed",
  admin_override: "Admin override",
};

/* ── Helpers ─────────────────────────────────────────────── */

function describeFieldChange(key: string, before: unknown, after: unknown): string {
  const labels: Record<string, string> = {
    name: "Item name", brand: "Brand", model: "Model", assetTag: "Asset tag",
    serialNumber: "Serial number", status: "Status", purchasePrice: "Purchase price",
    purchaseDate: "Purchase date", warrantyDate: "Warranty date", residualValue: "Residual value",
    linkUrl: "Link", notes: "Notes", categoryId: "Category", qrCodeValue: "QR code",
    availableForReservation: "Reservation availability", availableForCheckout: "Checkout availability",
    availableForCustody: "Custody availability",
  };
  const label = labels[key] || key;
  const from = before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  return `${label}: ${from} \u2192 ${to}`;
}

/* ── Activity Feed Component ────────────────────────────── */

export default function ActivityFeed({ assetId }: { assetId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetch(`/api/assets/${assetId}/activity`)
      .then((res) => { if (!res.ok) { setFetchError(true); return null; } return res.json(); })
      .then((json) => { if (json?.data) setEntries(json.data); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;

  if (fetchError) {
    return (
      <Empty className="py-8 border-0">
        <EmptyDescription>Failed to load activity history.</EmptyDescription>
      </Empty>
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="py-8 border-0">
        <EmptyDescription>No activity recorded yet.</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const isUpdate = entry.action === "updated" && entry.beforeJson && entry.afterJson;
        const isBookingEvent = entry.entityType === "booking";
        const changes = isUpdate
          ? Object.keys(entry.afterJson!).filter((k) => {
              const b = (entry.beforeJson as Record<string, unknown>)?.[k];
              const a = (entry.afterJson as Record<string, unknown>)?.[k];
              return String(b ?? "") !== String(a ?? "");
            })
          : [];

        return (
          <div className="flex gap-3 items-start" key={entry.id}>
            <Avatar className={`size-7 text-xs shrink-0 ${isBookingEvent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : ""}`}>
              <AvatarFallback className={isBookingEvent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : ""}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <strong>{actorName}</strong>{" "}
                {isBookingEvent ? (
                  <span>
                    {actionLabel}
                    {entry.afterJson && typeof entry.afterJson === "object" && "title" in entry.afterJson && (
                      <> &mdash; <em>{String(entry.afterJson.title)}</em></>
                    )}
                  </span>
                ) : (
                  <span>{actionLabel}</span>
                )}
              </div>
              {isUpdate && changes.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {changes.map((key) => (
                    <div key={key} className="text-xs text-muted-foreground font-mono">
                      {describeFieldChange(
                        key,
                        (entry.beforeJson as Record<string, unknown>)?.[key],
                        (entry.afterJson as Record<string, unknown>)?.[key],
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">{formatDateTime(entry.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
