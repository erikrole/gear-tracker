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

/** Status → Tailwind color classes for inline rendering (e.g. scan item preview) */
export function statusColorClasses(status: string): { bg: string; text: string } {
  switch (status) {
    case "AVAILABLE":
      return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" };
    case "CHECKED_OUT":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" };
    case "RESERVED":
      return { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" };
    case "MAINTENANCE":
      return { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" };
    case "RETIRED":
    default:
      return { bg: "bg-muted", text: "text-muted-foreground" };
  }
}
