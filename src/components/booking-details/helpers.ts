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

/** Status → shadcn Badge variant mapping (typed for BadgeProps) */
export const statusBadgeVariant: Record<string, "gray" | "blue" | "green" | "purple" | "red"> = {
  DRAFT: "gray",
  BOOKED: "blue",
  OPEN: "green",
  COMPLETED: "purple",
  CANCELLED: "red",
};

/** Universal user-facing status labels — DB enum stays unchanged */
export function statusLabel(status: string, kind?: "CHECKOUT" | "RESERVATION"): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "BOOKED":
      return kind === "CHECKOUT" ? "Booked" : "Confirmed";
    case "OPEN":
      return "Checked out";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

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
  create: "created booking",
  created: "created booking",
  update: "updated",
  updated: "updated",
  extend: "extended",
  extended: "extended",
  cancel: "cancelled",
  cancelled: "cancelled",
  checkin_completed: "completed check in",
  cancelled_by_checkout_conversion: "converted to checkout",
  "booking.items_added": "added items",
  "booking.items_removed": "removed items",
  "booking.items_qty_changed": "changed item quantities",
};

export function urgencyBadgeClassName(urgency: string): string {
  switch (urgency) {
    case "overdue":
      return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400";
    case "critical":
      return "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400";
    case "warning":
      return "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-500";
    default:
      return "";
  }
}
