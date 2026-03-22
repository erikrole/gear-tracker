export function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function toLocalDateTimeValue(date: Date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export const statusBadge: Record<string, string> = {
  DRAFT: "gray",
  BOOKED: "blue",
  OPEN: "green",
  COMPLETED: "purple",
  CANCELLED: "red",
};

/** Status → shadcn Badge variant mapping (typed for BadgeProps) */
export const statusBadgeVariant: Record<string, "gray" | "blue" | "green" | "purple" | "red"> = {
  DRAFT: "gray",
  BOOKED: "blue",
  OPEN: "green",
  COMPLETED: "purple",
  CANCELLED: "red",
};

/** Audit log fields to never display in the history tab */
export const HIDDEN_AUDIT_FIELDS = new Set([
  "_actorRole", "_actorId", "_actorEmail", "_actorName",
  "updatedAt", "createdAt", "id", "organizationId",
]);

/** Audit log fields that contain IDs — show "set"/"removed"/"changed" instead of raw values */
export const ID_AUDIT_FIELDS = new Set([
  "categoryId", "departmentId", "locationId", "requesterUserId",
]);

export const EQUIPMENT_ACTIONS = new Set([
  "booking.items_added",
  "booking.items_removed",
  "booking.items_qty_changed",
]);

export const actionLabels: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  extended: "Extended",
  cancelled: "Cancelled",
  checkin_completed: "Check in completed",
  cancelled_by_checkout_conversion: "Converted to checkout",
  "booking.items_added": "Items added",
  "booking.items_removed": "Items removed",
  "booking.items_qty_changed": "Item quantities changed",
};
