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
    label: "Allowed Emails",
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
  // Scheduling
  {
    href: "/settings/calendar-sources",
    label: "Calendar",
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
    label: "Venue Mappings",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Map raw calendar venue text to your locations.",
    keywords: ["regex", "pattern", "calendar venue", "match"],
  },
  {
    href: "/settings/bookings",
    label: "Extend Presets",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Default extend-due-date preset buttons for bookings.",
    keywords: ["bookings", "extend", "due date", "preset", "duration"],
  },
  {
    href: "/settings/escalation",
    label: "Escalation",
    requiredRole: "ADMIN",
    group: "Scheduling",
    description: "Overdue notification triggers and fatigue cap.",
    keywords: ["overdue", "notification", "alert", "trigger", "fatigue"],
  },
  // Devices
  {
    href: "/settings/kiosk-devices",
    label: "Kiosk",
    requiredRole: "ADMIN",
    group: "Devices",
    description: "iPad self-serve checkout stations + activation codes.",
    keywords: ["ipad", "self-serve", "checkout station", "activation"],
  },
  // System
  {
    href: "/settings/database",
    label: "Database",
    requiredRole: "ADMIN",
    group: "System",
    description: "On-demand schema health diagnostics.",
    keywords: ["schema", "migration", "diagnostics", "drift", "prisma"],
  },
  {
    href: "/settings/data-export",
    label: "Data Export",
    requiredRole: "ADMIN",
    group: "System",
    description: "Download inventory, bookings, users, and audit logs as CSV.",
    keywords: ["csv", "export", "download", "backup", "report", "audit", "bookings", "users", "items"],
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

export const REPORT_SECTIONS = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/bulk-losses", label: "Missing Units" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit" },
  { href: "/reports/badges", label: "Badges" },
] as const;
