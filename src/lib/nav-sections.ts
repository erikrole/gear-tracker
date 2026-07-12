/** Shared navigation section configs — used by layouts and breadcrumbs */

export type SettingsRole = "STUDENT" | "STAFF" | "ADMIN";

export type SettingsGroup =
  | "Personal"
  | "People"
  | "Inventory"
  | "Scheduling"
  | "Devices"
  | "System";

export type SettingsSection = {
  href: string;
  label: string;
  /** Minimum role required to see this tab — STUDENT means everyone. */
  requiredRole: SettingsRole;
  /** Logical grouping; drives tab dividers + headers in the search palette. */
  group: SettingsGroup;
  /** Short one-liner shown in the search palette + tooltip. */
  description: string;
  /** Extra search keywords for the palette so users find pages by intent, not memorised name. */
  keywords?: string[];
};

export const SETTINGS_GROUP_ORDER: SettingsGroup[] = [
  "Personal",
  "People",
  "Inventory",
  "Scheduling",
  "Devices",
  "System",
];

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  // Personal — visible to every authenticated user
  {
    href: "/settings/profile",
    label: "Profile",
    requiredRole: "STUDENT",
    group: "Personal",
    description: "Your name, contact info, area, and profile photo.",
    keywords: ["name", "phone", "avatar", "photo", "area", "title", "slack", "athletics email"],
  },
  {
    href: "/settings/security",
    label: "Security",
    requiredRole: "STUDENT",
    group: "Personal",
    description: "Change your password and manage active sessions.",
    keywords: ["password", "sessions", "sign out", "revoke", "devices", "logout"],
  },
  {
    href: "/settings/notifications",
    label: "Notifications",
    requiredRole: "STUDENT",
    group: "Personal",
    description: "Pause everything or pick which channels can reach you.",
    keywords: ["email", "push", "alerts", "do not disturb", "quiet", "mute"],
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    requiredRole: "STUDENT",
    group: "Personal",
    description: "Theme and text size.",
    keywords: ["theme", "dark mode", "light mode", "color", "font size", "text size", "accessibility"],
  },
  // People
  {
    href: "/settings/allowed-emails",
    label: "Registration access",
    requiredRole: "STAFF",
    group: "People",
    description: "Pre-approve email addresses for self-service registration.",
    keywords: ["allowlist", "registration", "invite", "users", "students", "staff"],
  },
  {
    href: "/settings/sports",
    label: "Sports",
    requiredRole: "STAFF",
    group: "People",
    description: "Toggle sports active and configure shift coverage + call times.",
    keywords: ["shift", "coverage", "roster", "calltime"],
  },
  // Inventory
  {
    href: "/settings/categories",
    label: "Categories",
    requiredRole: "STAFF",
    group: "Inventory",
    description: "Hierarchical categories for organizing equipment.",
    keywords: ["taxonomy", "tree", "subcategory"],
  },
  {
    href: "/settings/departments",
    label: "Departments",
    requiredRole: "STAFF",
    group: "Inventory",
    description: "Inventory ownership groups used by item forms, filters, and reports.",
    keywords: ["ownership", "team", "unit", "reporting", "items"],
  },
  // Inventory
  {
    href: "/settings/checkout-policies",
    label: "Checkout policies",
    requiredRole: "ADMIN",
    group: "Inventory",
    description: "Default loan duration, overdue grace period, and per-user item cap.",
    keywords: ["loan", "duration", "grace", "overdue", "max items", "cap", "limit", "checkout"],
  },
  // Scheduling
  {
    href: "/settings/reservation-rules",
    label: "Reservation rules",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Advance booking window, no-show expiry, and concurrent reservation cap.",
    keywords: ["advance", "window", "no-show", "expiry", "pending", "pickup", "max concurrent", "reservation"],
  },
  {
    href: "/settings/calendar-sources",
    label: "Calendar sources",
    requiredRole: "STAFF",
    group: "Scheduling",
    description: "ICS calendar feeds — add, sync, and monitor health.",
    keywords: ["ics", "feed", "sync", "events"],
  },
  {
    href: "/settings/locations",
    label: "Locations",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Catalog of physical locations + home venue toggles.",
    keywords: ["venue", "home venue", "address", "place"],
  },
  {
    href: "/settings/venue-mappings",
    label: "Venue mappings",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Map raw calendar venue text to your locations.",
    keywords: ["regex", "pattern", "calendar venue", "match"],
  },
  {
    href: "/settings/bookings",
    label: "Booking extensions",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Default extend-due-date preset buttons for bookings.",
    keywords: ["bookings", "extend", "due date", "preset", "duration"],
  },
  {
    href: "/settings/escalation",
    label: "Overdue escalation",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Overdue notification triggers and fatigue cap.",
    keywords: ["overdue", "notification", "alert", "trigger", "fatigue"],
  },
  // Devices
  {
    href: "/settings/kiosk-devices",
    label: "Kiosks",
    requiredRole: "ADMIN",
    group: "Devices",
    description: "iPad self-serve checkout stations + activation codes.",
    keywords: ["ipad", "self-serve", "checkout station", "activation"],
  },
  // System
  {
    href: "/settings/database",
    label: "Database diagnostics",
    requiredRole: "ADMIN",
    group: "System",
    description: "On-demand schema health diagnostics.",
    keywords: ["schema", "migration", "diagnostics", "drift", "prisma"],
  },
  {
    href: "/settings/data-export",
    label: "Data exports",
    requiredRole: "ADMIN",
    group: "System",
    description: "Download inventory, bookings, users, and audit logs as CSV.",
    keywords: ["csv", "export", "download", "backup", "report", "audit", "bookings", "users", "items"],
  },
  {
    href: "/settings/audit",
    label: "Audit log",
    requiredRole: "ADMIN",
    group: "System",
    description: "Live admin feed of all create, update, and delete actions across the system.",
    keywords: ["history", "activity", "log", "trail", "changes", "who", "when", "admin"],
  },
] as const;

const ROLE_RANK: Record<string, number> = { STUDENT: 0, STAFF: 1, ADMIN: 2 };

export function meetsRoleRequirement(required: SettingsRole, role: string): boolean {
  const userRank = ROLE_RANK[role];
  const requiredRank = ROLE_RANK[required];
  if (userRank === undefined || requiredRank === undefined) return false;
  return userRank >= requiredRank;
}

export function isSectionVisible(section: SettingsSection, role: string): boolean {
  return meetsRoleRequirement(section.requiredRole, role);
}

export type SettingsRouteAccess =
  | { kind: "overview"; section: null; allowed: true }
  | { kind: "section"; section: SettingsSection; allowed: boolean }
  | { kind: "unknown"; section: null; allowed: false };

/** Returns the most-specific registered section whose route owns this pathname. */
export function findSettingsSection(pathname: string): SettingsSection | null {
  return (
    SETTINGS_SECTIONS.filter(
      (section) => pathname === section.href || pathname.startsWith(`${section.href}/`)
    ).sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}

/** Central render decision for Settings routes. Unknown routes intentionally fail closed. */
export function getSettingsRouteAccess(pathname: string, role: string): SettingsRouteAccess {
  if (pathname === "/settings" || pathname === "/settings/") {
    return { kind: "overview", section: null, allowed: true };
  }

  const section = findSettingsSection(pathname);
  if (!section) return { kind: "unknown", section: null, allowed: false };

  return {
    kind: "section",
    section,
    allowed: isSectionVisible(section, role),
  };
}

export type ReportSection = {
  href: string;
  label: string;
  /** Minimum role required to see this report tab; omitted means every report viewer. */
  requiredRole?: SettingsRole;
};

export const REPORT_SECTIONS: ReadonlyArray<ReportSection> = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/bulk-losses", label: "Missing Units" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit", requiredRole: "ADMIN" },
  { href: "/reports/badges", label: "Badges" },
] as const;

export function isReportSectionVisible(section: ReportSection, role: string): boolean {
  return !section.requiredRole || meetsRoleRequirement(section.requiredRole, role);
}
