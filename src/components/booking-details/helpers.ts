import { formatRelativeTime } from "@/lib/format";
export function formatRelative(iso: string) { return formatRelativeTime(iso, new Date()); }

export function toLocalDateTimeValue(date: Date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Status → shadcn Badge variant, kind-aware for BOOKED */
export function statusBadgeVariant(status: string, kind?: "CHECKOUT" | "RESERVATION"): "gray" | "blue" | "green" | "purple" | "red" | "orange" {
  switch (status) {
    case "BOOKED": return kind === "RESERVATION" ? "purple" : "blue";
    case "OPEN": return "blue";
    case "PENDING_PICKUP": return "orange";
    case "CANCELLED": return "gray";
    case "DRAFT":
    case "COMPLETED":
    default: return "gray";
  }
}

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
      return "border-[var(--red-text)]/30 bg-[var(--red-bg)] text-[var(--red-text)]";
    case "critical":
    case "warning":
      return "border-[var(--orange-text)]/30 bg-[var(--orange-bg)] text-[var(--orange-text)]";
    default:
      return "";
  }
}
