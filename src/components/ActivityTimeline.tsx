"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Cog, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { getInitials } from "@/lib/avatar";
import { formatDateTime, formatDateShort, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Map an audit row's entity to a deep-link route, or null if no detail page exists. */
function entityHref(
  entityType: string | undefined,
  entityId: string | undefined,
  afterJson: Record<string, unknown> | null,
): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "booking": {
      const kind = (afterJson?.kind as string | undefined)?.toLowerCase();
      if (kind === "checkout") return `/checkouts/${entityId}`;
      if (kind === "reservation") return `/reservations/${entityId}`;
      // Unknown kind — let the bookings list resolve via id query.
      return `/bookings?id=${entityId}`;
    }
    case "asset":
      return `/items/${entityId}`;
    case "user":
      return `/users/${entityId}`;
    case "bulk_sku":
      return `/bulk-inventory/${entityId}`;
    case "kit":
      return `/settings/kits/${entityId}`;
    default:
      return null;
  }
}

/* ── Re-export AuditEntry type as canonical ── */

export type AuditEntry = {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  actor: { id?: string; name: string; email?: string; avatarUrl?: string | null } | null;
};

/* ── Props ── */

export type ActivityTimelineProps = {
  entries: AuditEntry[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Context for generating descriptions */
  context?: "booking" | "item" | "report" | "user";
  /** Entity name for better descriptions */
  entityName?: string;
  /** Empty state message */
  emptyMessage?: string;
};

/* ── Constants ── */

const SYSTEM_ACTIONS = new Set([
  "auto_escalation",
  "cron_notification",
  "auto_complete",
]);

/** Fields that are internal/system and should not be shown in the UI */
const HIDDEN_FIELDS = new Set([
  "_actorRole",
  "_actorId",
  "_actorEmail",
  "_actorName",
  "updatedAt",
  "createdAt",
  "id",
  "organizationId",
  "sourcePayload",
  "cheqroomName",
  "fiscalYear",
  "fiscalYearPurchased",
  "consumable",
  "trackByNumber",
]);

/** Fields whose values are opaque IDs — show "changed" instead of raw value */
const ID_FIELDS = new Set([
  "categoryId",
  "departmentId",
  "locationId",
  "requesterUserId",
  "parentAssetId",
]);

const EQUIPMENT_ACTIONS = new Set([
  "booking.items_added",
  "booking.items_removed",
  "booking.items_qty_changed",
]);

/** Human-readable field name labels */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  name: "Item name",
  brand: "Brand",
  model: "Model",
  assetTag: "Asset tag",
  serialNumber: "Serial number",
  notes: "Notes",
  status: "Status",
  startsAt: "Start date",
  endsAt: "End date",
  locationId: "Location",
  categoryId: "Category",
  departmentId: "Department",
  requesterUserId: "Requester",
  parentAssetId: "Parent item",
  serializedAssetIds: "Equipment",
  bulkItems: "Bulk items",
  purchasePrice: "Purchase price",
  purchaseDate: "Purchase date",
  warrantyDate: "Warranty date",
  residualValue: "Residual value",
  linkUrl: "Link",
  qrCodeValue: "QR code",
  availableForReservation: "Reservation availability",
  availableForCheckout: "Checkout availability",
  availableForCustody: "Custody availability",
  imageUrl: "Image",
};

/** Status vocabulary mapping */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  BOOKED: "Confirmed",
  OPEN: "Checked out",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Action color scheme */
type ActionColorKey =
  | "green"
  | "blue"
  | "amber"
  | "rose"
  | "purple"
  | "muted";

const ACTION_COLORS: Record<string, ActionColorKey> = {
  created: "green",
  create: "green",
  "booking.created": "green",
  checkin_completed: "green",
  items_returned: "green",
  items_returned_partial: "green",
  checkout_completed: "green",
  checkout_scan_completed: "green",
  scan_completed: "green",
  updated: "blue",
  update: "blue",
  extended: "blue",
  extend: "blue",
  duplicated: "blue",
  "booking.items_added": "amber",
  "booking.items_removed": "amber",
  "booking.items_qty_changed": "amber",
  marked_maintenance: "amber",
  cleared_maintenance: "amber",
  partial_return_recorded: "amber",
  cancelled: "rose",
  cancel: "rose",
  deleted: "rose",
  retired: "rose",
  cancelled_by_checkout_conversion: "blue",
  auto_escalation: "purple",
  cron_notification: "purple",
  admin_override: "purple",
  qr_generated: "muted",
  auto_complete: "muted",
  accessory_attached: "blue",
  accessory_detached: "amber",
  accessory_moved: "blue",
  image_uploaded: "blue",
  image_deleted: "amber",
  escalation_config_updated: "purple",
  escalation_rule_updated: "purple",
  profile_updated: "blue",
  draft_discarded: "rose",
  password_reset_requested: "muted",
  password_reset_completed: "muted",
  user_deactivated: "rose",
  user_activated: "green",
  role_changed: "purple",
  login: "green",
  logout: "muted",
  registered: "green",
  password_reset_self: "muted",
  kiosk_activated: "green",
};

const RING_CLASSES: Record<ActionColorKey, string> = {
  green:  "ring-[var(--green)]/40",
  blue:   "ring-[var(--blue)]/40",
  amber:  "ring-[var(--orange)]/40",
  rose:   "ring-[var(--red)]/40",
  purple: "ring-[var(--purple)]/40",
  muted:  "ring-border",
};

/** Resolve a friendly target phrase from the audit entry — used by `user` context
 *  where each row references a different entity. Falls back to the entityType
 *  with a short id suffix if no human-readable name is available. */
function userTarget(entry: AuditEntry): string {
  const after = entry.afterJson ?? {};
  const before = entry.beforeJson ?? {};
  if (entry.entityType === "user") return "their profile";
  if (entry.entityType === "booking") {
    const t = (after.title as string | undefined) ?? (before.title as string | undefined);
    return t ? `booking "${t}"` : "a booking";
  }
  if (entry.entityType === "asset") {
    const t = (after.name as string | undefined) ?? (before.name as string | undefined);
    return t ? `item "${t}"` : "an item";
  }
  if (entry.entityType === "kit") {
    const t = (after.name as string | undefined) ?? (before.name as string | undefined);
    return t ? `kit "${t}"` : "a kit";
  }
  if (entry.entityType === "license") return "a license";
  return entry.entityType
    ? `a ${entry.entityType.replace(/_/g, " ")}`
    : "this resource";
}

/** Generate a natural-language description of an action */
function describeAction(
  entry: AuditEntry,
  actorName: string,
  context: "booking" | "item" | "report" | "user",
  entityName?: string,
): string {
  const target =
    context === "booking"
      ? "this booking"
      : context === "item"
        ? entityName || "this item"
        : context === "user"
          ? userTarget(entry)
          : entityName
            ? entityName
            : entry.entityType
              ? `${entry.entityType} ${(entry.entityId ?? "").slice(0, 8)}`
              : "this resource";

  const reportPrefix = context === "report" ? `${actorName} ` : "";

  switch (entry.action) {
    case "created":
    case "create":
    case "booking.created":
      return context === "report"
        ? `${actorName} created ${target}`
        : context === "booking"
          ? "Created this booking"
          : context === "item"
            ? "Created this item"
            : `Created ${target}`;
    case "updated":
    case "update":
      return context === "report"
        ? `${actorName} updated ${target}`
        : context === "user"
          ? `Updated ${target}`
          : "Updated details";
    case "extended":
    case "extend": {
      const newEnd =
        entry.afterJson && typeof entry.afterJson.endsAt === "string"
          ? formatDateTime(entry.afterJson.endsAt)
          : null;
      return newEnd
        ? `${reportPrefix}Extended the checkout to ${newEnd}`
        : `${reportPrefix}Extended the checkout`;
    }
    case "cancelled":
    case "cancel":
      return `${reportPrefix}Cancelled ${
        context === "report" || context === "user" ? target : "the booking"
      }`;
    case "deleted":
      return `${reportPrefix}Deleted ${target}`;
    case "retired":
      return `${reportPrefix}Retired ${target}`;
    case "checkin_completed":
      return `${reportPrefix}Completed check-in`;
    case "checkout_completed":
      return `${reportPrefix}Completed checkout`;
    case "checkout_scan_completed":
    case "scan_completed":
      return `${reportPrefix}Completed scan`;
    case "cancelled_by_checkout_conversion":
      return `${reportPrefix}Converted reservation to checkout`;
    case "items_returned":
      return `${reportPrefix}All items returned`;
    case "items_returned_partial":
      return `${reportPrefix}Some items returned`;
    case "partial_return_recorded":
      return `${reportPrefix}Recorded partial return`;
    case "marked_maintenance":
      return `${reportPrefix}Marked as needs maintenance`;
    case "cleared_maintenance":
      return `${reportPrefix}Cleared maintenance status`;
    case "duplicated":
      return `${reportPrefix}Duplicated ${target}`;
    case "qr_generated":
      return `${reportPrefix}Generated new QR code`;
    case "admin_override":
      return `${reportPrefix}Admin override`;
    case "auto_escalation":
      return "System auto-escalated overdue notification";
    case "cron_notification":
      return "System sent scheduled notification";
    case "auto_complete":
      return "System auto-completed";
    case "booking.items_added": {
      const counts = getEquipmentCounts(entry.afterJson);
      return counts
        ? `${reportPrefix}Added ${counts}`
        : `${reportPrefix}Added items`;
    }
    case "booking.items_removed": {
      const counts = getEquipmentCounts(entry.beforeJson);
      return counts
        ? `${reportPrefix}Removed ${counts}`
        : `${reportPrefix}Removed items`;
    }
    case "booking.items_qty_changed":
      return `${reportPrefix}Changed item quantities`;
    case "accessory_attached": {
      const accName = entry.afterJson?.name || entry.afterJson?.accessoryName;
      return accName
        ? `${reportPrefix}Attached accessory "${accName}"`
        : `${reportPrefix}Attached an accessory`;
    }
    case "accessory_detached": {
      const detName = entry.beforeJson?.name || entry.beforeJson?.accessoryName;
      return detName
        ? `${reportPrefix}Detached accessory "${detName}"`
        : `${reportPrefix}Detached an accessory`;
    }
    case "accessory_moved": {
      const movName = entry.afterJson?.name || entry.afterJson?.accessoryName;
      return movName
        ? `${reportPrefix}Moved accessory "${movName}" to another item`
        : `${reportPrefix}Moved an accessory to another item`;
    }
    case "image_uploaded":
      return `${reportPrefix}Uploaded a photo`;
    case "image_deleted":
      return `${reportPrefix}Removed a photo`;
    case "escalation_config_updated":
      return `${reportPrefix}Updated escalation settings`;
    case "escalation_rule_updated":
      return `${reportPrefix}Updated an escalation rule`;
    case "profile_updated":
      return `${reportPrefix}Updated their profile`;
    case "draft_discarded":
      return `${reportPrefix}Discarded a draft booking`;
    case "password_reset_requested":
      return `${reportPrefix}Requested a password reset`;
    case "password_reset_completed":
      return `${reportPrefix}Reset their password`;
    case "user_deactivated":
      return `${reportPrefix}Deactivated a user account`;
    case "user_activated":
      return `${reportPrefix}Activated a user account`;
    case "role_changed":
      return `${reportPrefix}Changed a user's role`;
    case "login":
      return `${reportPrefix}Signed in`;
    case "logout":
      return `${reportPrefix}Signed out`;
    case "registered":
      return `${reportPrefix}Created an account`;
    case "password_reset_self":
      return `${reportPrefix}Reset their password`;
    case "kiosk_activated":
      return "Kiosk device activated";
    default:
      if (context === "report") {
        return `${actorName} performed ${entry.action.replace(/_/g, " ")}`;
      }
      if (context === "user") {
        return `${entry.action.replace(/_/g, " ")} on ${target}`;
      }
      return entry.action.replace(/_/g, " ");
  }
}

function getEquipmentCounts(
  json: Record<string, unknown> | null,
): string | null {
  if (!json) return null;
  const parts: string[] = [];
  if (Array.isArray(json.serializedAssetIds)) {
    const n = json.serializedAssetIds.length;
    parts.push(`${n} serialized item${n !== 1 ? "s" : ""}`);
  }
  if (Array.isArray(json.bulkItems)) {
    const n = json.bulkItems.length;
    parts.push(`${n} bulk item${n !== 1 ? "s" : ""}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

/* ── Field change description ── */

type FieldChange = { label: string; from: string; to: string };

function describeFieldChange(
  key: string,
  before: unknown,
  after: unknown,
): FieldChange | null {
  if (HIDDEN_FIELDS.has(key)) return null;

  const label = FIELD_LABELS[key] || key;

  // For ID fields, show "set" / "removed" / "changed" instead of raw IDs
  if (ID_FIELDS.has(key)) {
    const hadBefore = before != null && before !== "";
    const hasAfter = after != null && after !== "";
    if (!hadBefore && hasAfter) return { label, from: "", to: "set" };
    if (hadBefore && !hasAfter) return { label, from: "", to: "removed" };
    return { label, from: "", to: "changed" };
  }

  // Boolean fields
  if (
    typeof after === "boolean" ||
    after === "true" ||
    after === "false"
  ) {
    return {
      label,
      from: "",
      to: String(after) === "true" ? "enabled" : "disabled",
    };
  }

  // Skip array and object fields in generic diff (shown via equipment actions or too complex)
  if (Array.isArray(before) || Array.isArray(after)) return null;
  if ((before != null && typeof before === "object") || (after != null && typeof after === "object")) return null;

  // Status fields - use human-readable labels
  if (key === "status") {
    const from =
      before == null || before === ""
        ? "empty"
        : STATUS_LABELS[String(before)] || String(before);
    const to =
      after == null || after === ""
        ? "empty"
        : STATUS_LABELS[String(after)] || String(after);
    if (from === to) return null;
    return { label, from, to };
  }

  // Date fields - format as readable dates
  if (
    key === "startsAt" ||
    key === "endsAt" ||
    key === "purchaseDate" ||
    key === "warrantyDate"
  ) {
    const from =
      before == null || before === ""
        ? "empty"
        : formatDateTime(String(before));
    const to =
      after == null || after === ""
        ? "empty"
        : formatDateTime(String(after));
    if (from === to) return null;
    return { label, from, to };
  }

  const from =
    before == null || before === "" ? "empty" : String(before);
  const to = after == null || after === "" ? "empty" : String(after);
  if (from === to) return null;
  return { label, from, to };
}

function getFieldChanges(entry: AuditEntry): FieldChange[] {
  if (
    entry.action !== "updated" ||
    !entry.beforeJson ||
    !entry.afterJson
  )
    return [];
  return Object.keys(entry.afterJson)
    .map((k) => {
      const b = (entry.beforeJson as Record<string, unknown>)?.[k];
      const a = (entry.afterJson as Record<string, unknown>)?.[k];
      return describeFieldChange(k, b, a);
    })
    .filter((c): c is FieldChange => c !== null);
}

/* ── Date grouping ── */

function getDateGroup(iso: string, today: Date): string {
  const d = new Date(iso);
  const todayStr = today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === todayStr) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso: string, today: Date): string {
  const d = new Date(iso);
  if (d.toDateString() === today.toDateString()) {
    return formatRelativeTime(iso, today);
  }
  return `${formatDateShort(iso)} at ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/* ── Skeleton loader ── */

export function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Single entry row ── */

function TimelineEntry({
  entry,
  context,
  entityName,
  today,
}: {
  entry: AuditEntry;
  context: "booking" | "item" | "report" | "user";
  entityName?: string;
  today: Date;
}) {
  const isSystem =
    !entry.actor || SYSTEM_ACTIONS.has(entry.action);
  const actorName = entry.actor?.name
    ?? (SYSTEM_ACTIONS.has(entry.action) ? "System" : "Unknown user");
  const colorKey = ACTION_COLORS[entry.action] ?? "muted";
  const ringClass = RING_CLASSES[colorKey];

  const description = describeAction(
    entry,
    actorName,
    context,
    entityName,
  );
  const changes = getFieldChanges(entry);

  // Skip update entries where all changes were hidden internal fields
  if (
    entry.action === "updated" &&
    entry.beforeJson &&
    entry.afterJson &&
    changes.length === 0
  )
    return null;

  // On user / report contexts each row references a different entity — make the
  // row clickable when a detail page exists. Booking / item context rows already
  // live on the entity's page so a self-link is redundant.
  const linkable =
    (context === "user" || context === "report") &&
    entityHref(entry.entityType, entry.entityId, entry.afterJson);
  const Wrapper: React.ElementType = linkable ? Link : "div";
  const wrapperProps = linkable
    ? {
        href: linkable,
        className:
          "flex gap-3 items-start py-2.5 px-3 sm:px-4 no-underline text-inherit hover:bg-muted/40 transition-colors",
      }
    : { className: "flex gap-3 items-start py-2.5 px-3 sm:px-4" };

  return (
    <Wrapper {...wrapperProps}>
      {/* Avatar or system icon */}
      {isSystem ? (
        <div
          className={cn(
            "size-8 rounded-full flex items-center justify-center shrink-0 ring-2 bg-muted",
            ringClass,
          )}
        >
          <Cog className="size-4 text-muted-foreground" />
        </div>
      ) : (
        <Avatar
          className={cn("size-8 shrink-0 ring-2", ringClass)}
        >
          {entry.actor?.avatarUrl && (
            <AvatarImage src={entry.actor.avatarUrl} alt={actorName} />
          )}
          <AvatarFallback>
            {getInitials(actorName)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          {context !== "report" && (
            <span className="text-sm font-medium truncate">{actorName}</span>
          )}
          <span className="text-sm text-muted-foreground">
            {description}
          </span>
          <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">
            {formatTimestamp(entry.createdAt, today)}
          </span>
        </div>

        {/* Field change pills */}
        {changes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {changes.map((change) => (
              <span
                key={change.label}
                className="inline-flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-0.5"
              >
                <span className="font-medium text-foreground/70">
                  {change.label}
                </span>
                {change.from ? (
                  <>
                    <span className="line-through opacity-50">
                      {change.from}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground/50" />
                    <span>{change.to}</span>
                  </>
                ) : (
                  <span>{change.to}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

/* ── Main component ── */

export default function ActivityTimeline({
  entries,
  loading,
  hasMore,
  onLoadMore,
  context = "booking",
  entityName,
  emptyMessage = "No activity recorded yet.",
}: ActivityTimelineProps) {
  const today = useMemo(() => new Date(), []);

  // Group entries by date
  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const entry of entries) {
      const group = getDateGroup(entry.createdAt, today);
      const arr = map.get(group);
      if (arr) arr.push(entry);
      else map.set(group, [entry]);
    }
    return Array.from(map.entries());
  }, [entries, today]);

  if (loading && entries.length === 0) {
    return <TimelineSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <Empty className="py-8 border-0">
        <EmptyDescription>{emptyMessage}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div>
      {groups.map(([dateLabel, groupEntries]) => (
        <div key={dateLabel}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-3 sm:px-4 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {dateLabel}
            </span>
          </div>

          {/* Entries */}
          <div className="divide-y divide-border/30">
            {groupEntries.map((entry) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                context={context}
                entityName={entityName}
                today={today}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && onLoadMore && (
        <>
          <Separator className="opacity-30" />
          <div className="py-3 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onLoadMore}
          >
            {loading ? "Loading\u2026" : "Load older entries"}
          </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Re-export utilities for consumers ── */

export { EQUIPMENT_ACTIONS, HIDDEN_FIELDS as HIDDEN_AUDIT_FIELDS };
