/** Shared navigation section configs — used by layouts and breadcrumbs */

export const SETTINGS_SECTIONS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/sports", label: "Sports" },
  { href: "/settings/escalation", label: "Escalation" },
  { href: "/settings/calendar-sources", label: "Calendar" },
  { href: "/settings/venue-mappings", label: "Venue Mappings" },
  { href: "/settings/database", label: "Database" },
] as const;

export const REPORT_SECTIONS = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit" },
] as const;
