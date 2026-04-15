/** Equipment status → human-readable label */
export function statusLabelEquipment(status: string): string {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "CHECKED_OUT": return "Checked Out";
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
    case "RESERVED": return "purple";
    case "MAINTENANCE": return "orange";
    default: return "gray";
  }
}

/** Unified status → badge variant mapping for all pages */
export function statusBadgeVariant(status: string): string {
  switch (status) {
    case "AVAILABLE":
      return "green";
    case "OPEN":
    case "BOOKED":
    case "CHECKED_OUT":
      return "blue";
    case "RESERVED":
      return "purple";
    case "MAINTENANCE":
      return "orange";
    case "OVERDUE":
      return "red";
    case "COMPLETED":
    case "CANCELLED":
    case "RETIRED":
    default:
      return "gray";
  }
}

