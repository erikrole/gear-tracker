/** Shared navigation section configs — used by layouts and breadcrumbs */

export type SettingsRole = "STAFF" | "ADMIN";

export type SettingsSection = {
  href: string;
  label: string;
  /** Minimum role required to use this tab — must match the API gating for the page. */
  requiredRole: SettingsRole;
};

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  { href: "/settings/categories", label: "Categories", requiredRole: "STAFF" },
  { href: "/settings/sports", label: "Sports", requiredRole: "STAFF" },
  { href: "/settings/bookings", label: "Bookings", requiredRole: "ADMIN" },
  { href: "/settings/escalation", label: "Escalation", requiredRole: "ADMIN" },
  { href: "/settings/calendar-sources", label: "Calendar", requiredRole: "STAFF" },
  { href: "/settings/locations", label: "Locations", requiredRole: "ADMIN" },
  { href: "/settings/venue-mappings", label: "Venue Mappings", requiredRole: "ADMIN" },
  { href: "/settings/allowed-emails", label: "Allowed Emails", requiredRole: "STAFF" },
  { href: "/settings/kiosk-devices", label: "Kiosk", requiredRole: "ADMIN" },
  { href: "/settings/database", label: "Database", requiredRole: "ADMIN" },
] as const;

export function isSectionVisible(section: SettingsSection, role: string): boolean {
  if (section.requiredRole === "ADMIN") return role === "ADMIN";
  return role === "ADMIN" || role === "STAFF";
}

export const REPORT_SECTIONS = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/bulk-losses", label: "Bulk Losses" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit" },
] as const;
