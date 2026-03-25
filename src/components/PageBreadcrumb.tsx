"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { Skeleton } from "@/components/ui/skeleton";

// ── Config ──────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  items: "Items",
  checkouts: "Checkouts",
  reservations: "Reservations",
  kits: "Kits",
  labels: "Labels",
  import: "Import",
  scan: "Scan",
  search: "Search",
  settings: "Settings",
  reports: "Reports",
  users: "Users",
  profile: "Profile",
  notifications: "Notifications",
  schedule: "Schedule",
  events: "Schedule",
  bookings: "Bookings",
  "bulk-inventory": "Bulk Inventory",
  "calendar-sources": "Calendar Sources",
  "venue-mappings": "Venue Mappings",
  database: "Database",
  categories: "Categories",
  escalation: "Escalation",
  sports: "Sports",
  utilization: "Utilization",
  overdue: "Overdue",
  scans: "Scans",
  audit: "Audit",
};

/** Segments whose breadcrumb link should point to a different route */
const HREF_OVERRIDE: Record<string, string> = {
  events: "/schedule",
};

/** Sibling routes for quick-jump navigation within a section */
const SETTINGS_SIBLINGS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/sports", label: "Sports" },
  { href: "/settings/escalation", label: "Escalation" },
  { href: "/settings/calendar-sources", label: "Calendar" },
  { href: "/settings/venue-mappings", label: "Venue Mappings" },
  { href: "/settings/database", label: "Database" },
];

const REPORTS_SIBLINGS = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit" },
];

const SIBLING_MAP: Record<string, Array<{ href: string; label: string }>> = {
  // Parent-level entries — dropdown on the "Settings" or "Reports" crumb itself
  "/settings": SETTINGS_SIBLINGS,
  "/reports": REPORTS_SIBLINGS,
};

// Register each child route to the same sibling list
for (const s of SETTINGS_SIBLINGS) SIBLING_MAP[s.href] = SETTINGS_SIBLINGS;
for (const s of REPORTS_SIBLINGS) SIBLING_MAP[s.href] = REPORTS_SIBLINGS;

/** Collapse middle crumbs when total exceeds this threshold */
const COLLAPSE_THRESHOLD = 3;

const RECENT_STORAGE_KEY = "breadcrumb-recent";
const MAX_RECENT = 5;

// ── Recent entities (localStorage) ──────────────────────

type RecentEntity = { href: string; label: string; section: string };

function getRecentEntities(section: string): RecentEntity[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const all: RecentEntity[] = JSON.parse(raw);
    return all.filter((e) => e.section === section).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentEntity(entity: RecentEntity) {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const all: RecentEntity[] = raw ? JSON.parse(raw) : [];
    // Remove duplicate, prepend new entry
    const filtered = all.filter((e) => e.href !== entity.href);
    filtered.unshift(entity);
    // Keep max per section, max 30 total
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(filtered.slice(0, 30)));
  } catch {
    // localStorage unavailable
  }
}

// ── Helpers ─────────────────────────────────────────────

function formatSegment(segment: string): string {
  return LABEL_MAP[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isDynamicSegment(segment: string): boolean {
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return true;
  if (/^c[a-z0-9]{20,}$/.test(segment)) return true;
  return false;
}

// ── Component ───────────────────────────────────────────

export default function PageBreadcrumb() {
  const pathname = usePathname();
  const { label: entityLabel } = useBreadcrumbLabel();
  const [expanded, setExpanded] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  // Save entity to recent list when label is set on a detail page
  const firstSegment = segments[0] ?? "";
  useEffect(() => {
    if (entityLabel && segments.some(isDynamicSegment)) {
      saveRecentEntity({ href: pathname, label: entityLabel, section: firstSegment });
    }
  }, [entityLabel, pathname, firstSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't show breadcrumb on the home page
  if (segments.length === 0) return null;

  // Build crumbs, filtering out dynamic segments (IDs)
  const crumbs: Array<{ href: string; label: string }> = [];
  for (let i = 0; i < segments.length; i++) {
    if (isDynamicSegment(segments[i])) continue;
    const href = HREF_OVERRIDE[segments[i]] ?? "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: formatSegment(segments[i]) });
  }

  const onDetailPage = segments.length > crumbs.length;

  // All crumbs including Home and optional entity label
  const allItems: Array<{ href: string; label: string; isPage: boolean; segment?: string }> = [
    { href: "/", label: "Home", isPage: false },
    ...crumbs.map((crumb, i) => ({
      ...crumb,
      isPage: i === crumbs.length - 1 && !onDetailPage && !entityLabel,
      segment: segments[i] ?? undefined,
    })),
  ];

  if (onDetailPage) {
    allItems.forEach((item) => { item.isPage = false; });
  }

  if (onDetailPage && entityLabel) {
    allItems.push({ href: pathname, label: entityLabel, isPage: true });
  }

  // Collapse logic
  const shouldCollapse = !expanded && allItems.length > COLLAPSE_THRESHOLD;
  const visibleItems = shouldCollapse
    ? [allItems[0], ...allItems.slice(-2)]
    : allItems;

  // Get siblings and recent entities for the current path
  const recentEntities = onDetailPage ? getRecentEntities(firstSegment) : [];

  // Show loading skeleton when on a detail page and entity label hasn't arrived yet
  const showSkeleton = onDetailPage && !entityLabel;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visibleItems.map((item, i) => {
          const hasSiblings = !item.isPage && SIBLING_MAP[item.href] != null;
          const hasRecent = item.isPage && onDetailPage && recentEntities.length > 1;

          return (
            <span key={item.href + item.label} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              {shouldCollapse && i === 1 && (
                <>
                  <BreadcrumbItem>
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="flex items-center"
                      aria-label="Show full breadcrumb path"
                    >
                      <BreadcrumbEllipsis />
                    </button>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                {item.isPage && !hasRecent ? (
                  <BreadcrumbPage className="max-w-[200px] truncate">{item.label}</BreadcrumbPage>
                ) : hasSiblings ? (
                  <SiblingDropdown
                    currentHref={item.href}
                    label={item.label}
                    siblings={SIBLING_MAP[item.href]}
                  />
                ) : hasRecent ? (
                  <RecentDropdown
                    currentLabel={item.label}
                    recents={recentEntities}
                    currentHref={pathname}
                  />
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="max-w-[200px] truncate">{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
        {showSkeleton && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Skeleton className="h-4 w-24" />
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// ── Sibling Quick-Jump Dropdown ─────────────────────────

function SiblingDropdown({
  currentHref,
  label,
  siblings,
}: {
  currentHref: string;
  label: string;
  siblings: Array<{ href: string; label: string }>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span className="max-w-[200px] truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {siblings.map((s) => (
          <DropdownMenuItem key={s.href} asChild disabled={s.href === currentHref}>
            <Link href={s.href} className={s.href === currentHref ? "font-semibold" : ""}>
              {s.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Recently Visited Entities Dropdown ──────────────────

function RecentDropdown({
  currentLabel,
  recents,
  currentHref,
}: {
  currentLabel: string;
  recents: RecentEntity[];
  currentHref: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-0.5 text-sm font-normal" aria-label="Recently visited">
        <BreadcrumbPage className="max-w-[200px] truncate">{currentLabel}</BreadcrumbPage>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {recents.map((r) => (
          <DropdownMenuItem key={r.href} asChild disabled={r.href === currentHref}>
            <Link href={r.href} className={r.href === currentHref ? "font-semibold" : ""}>
              <span className="max-w-[250px] truncate">{r.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
