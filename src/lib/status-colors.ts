/** Equipment status → human-readable label */
export function statusLabelEquipment(status: string): string {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "CHECKED_OUT": return "Checked Out";
    case "PENDING_PICKUP": return "Awaiting Pickup";
    case "RESERVED": return "Reserved";
    case "MAINTENANCE": return "In Maintenance";
    case "RETIRED": return "Retired";
    default: return status;
  }
}

/** Equipment status → badge variant */
export function statusBadgeVariantEquipment(status: string): "green" | "blue" | "purple" | "orange" | "gray" {
  switch (status) {
    case "AVAILABLE": return "green";
    case "CHECKED_OUT": return "blue";
    case "PENDING_PICKUP": return "orange";
    case "RESERVED": return "purple";
    case "MAINTENANCE": return "orange";
    default: return "gray";
  }
}

/** Equipment+booking status → badge variant for search/scan contexts (no kind context available) */
export function statusBadgeVariant(status: string): string {
  switch (status) {
    case "AVAILABLE": return "green";
    case "OPEN":
    case "BOOKED":
    case "CHECKED_OUT": return "blue";
    case "RESERVED": return "purple";
    case "PENDING_PICKUP":
    case "MAINTENANCE": return "orange";
    case "OVERDUE": return "red";
    default: return "gray";
  }
}
