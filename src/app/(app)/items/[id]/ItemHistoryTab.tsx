"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** Fields that are internal/system and should not be shown in the UI */
const HIDDEN_FIELDS = new Set([
  "_actorRole", "_actorId", "_actorEmail", "_actorName",
  "updatedAt", "createdAt", "id", "organizationId",
]);

/** Fields whose values are opaque IDs — show "changed" instead of raw value */
const ID_FIELDS = new Set([
  "categoryId", "departmentId", "locationId", "parentAssetId",
]);

function describeFieldChange(key: string, before: unknown, after: unknown): { label: string; from: string; to: string } | null {
  if (HIDDEN_FIELDS.has(key)) return null;

  const labels: Record<string, string> = {
    name: "Item name", brand: "Brand", model: "Model", assetTag: "Asset tag",
    serialNumber: "Serial number", status: "Status", purchasePrice: "Purchase price",
    purchaseDate: "Purchase date", warrantyDate: "Warranty date", residualValue: "Residual value",
    linkUrl: "Link", notes: "Notes", categoryId: "Category", qrCodeValue: "QR code",
    departmentId: "Department", locationId: "Location", parentAssetId: "Parent item",
    availableForReservation: "Reservation availability", availableForCheckout: "Checkout availability",
    availableForCustody: "Custody availability", imageUrl: "Image",
  };
  const label = labels[key] || key;

  // For ID fields, show "set" / "removed" / "changed" instead of raw IDs
  if (ID_FIELDS.has(key)) {
    const hadBefore = before != null && before !== "";
    const hasAfter = after != null && after !== "";
    if (!hadBefore && hasAfter) return { label, from: "", to: "set" };
    if (hadBefore && !hasAfter) return { label, from: "", to: "removed" };
    return { label, from: "", to: "changed" };
  }

  // Boolean fields
  if (typeof after === "boolean" || after === "true" || after === "false") {
    return { label, from: "", to: String(after) === "true" ? "enabled" : "disabled" };
  }

  const from = before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  return { label, from, to };
}

/* ── Activity Feed Component ────────────────────────────── */

export default function ActivityFeed({ assetId }: { assetId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const loadActivity = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/assets/${assetId}/activity`)
      .then((res) => { if (!res.ok) { setFetchError(true); return null; } return res.json(); })
      .then((json) => { if (json?.data) setEntries(json.data); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  if (loading) return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;

  if (fetchError) {
    return (
      <Empty className="py-8 border-0">
        <AlertTriangle className="size-8 text-muted-foreground opacity-50 mx-auto mb-2" />
        <EmptyDescription>Failed to load activity history.</EmptyDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={loadActivity}>
          Retry
        </Button>
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
    <div className="flex flex-col divide-y divide-border/40">
      {entries.map((entry) => {
        const actorName = entry.actor?.name || "System";
        const initial = actorName.slice(0, 1).toUpperCase();
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const isUpdate = entry.action === "updated" && entry.beforeJson && entry.afterJson;
        const isBookingEvent = entry.entityType === "booking";
        const changes = isUpdate
          ? Object.keys(entry.afterJson!)
              .map((k) => {
                const b = (entry.beforeJson as Record<string, unknown>)?.[k];
                const a = (entry.afterJson as Record<string, unknown>)?.[k];
                if (String(b ?? "") === String(a ?? "")) return null;
                return describeFieldChange(k, b, a);
              })
              .filter((c): c is NonNullable<typeof c> => c !== null)
          : [];

        // Skip update entries where all changes were hidden internal fields
        if (isUpdate && changes.length === 0) return null;

        return (
          <div className="flex gap-3 items-start py-3 first:pt-0 last:pb-0" key={entry.id}>
            <Avatar className={`size-7 text-xs shrink-0 mt-0.5 ${isBookingEvent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : ""}`}>
              <AvatarFallback className={isBookingEvent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : ""}>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium">{actorName}</span>
                <span className="text-sm text-muted-foreground">
                  {isBookingEvent ? (
                    <>
                      {actionLabel}
                      {entry.afterJson && typeof entry.afterJson === "object" && "title" in entry.afterJson && (
                        <> &mdash; <em>{String(entry.afterJson.title)}</em></>
                      )}
                    </>
                  ) : (
                    actionLabel
                  )}
                </span>
                <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">{formatDateTime(entry.createdAt)}</span>
              </div>
              {changes.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1">
                  {changes.map((change) => (
                    <div key={change.label} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="font-medium text-foreground/70">{change.label}</span>
                      {change.from ? (
                        <>
                          <span className="line-through opacity-50">{change.from}</span>
                          <span className="text-muted-foreground/50">{"\u2192"}</span>
                          <span>{change.to}</span>
                        </>
                      ) : (
                        <span>{change.to}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
