"use client";

import { useState } from "react";
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
import Link from "next/link";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";

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

/** Collapse middle crumbs when total exceeds this threshold */
const COLLAPSE_THRESHOLD = 3;

function formatSegment(segment: string): string {
  return LABEL_MAP[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isDynamicSegment(segment: string): boolean {
  // UUIDs (hex + hyphens, 8+ chars)
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return true;
  // CUIDs (start with 'c', alphanumeric, 20+ chars)
  if (/^c[a-z0-9]{20,}$/.test(segment)) return true;
  return false;
}

export default function PageBreadcrumb() {
  const pathname = usePathname();
  const { label: entityLabel } = useBreadcrumbLabel();
  const [expanded, setExpanded] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumb on the home page
  if (segments.length === 0) return null;

  // Build crumbs, filtering out dynamic segments (IDs)
  const crumbs: Array<{ href: string; label: string }> = [];
  for (let i = 0; i < segments.length; i++) {
    if (isDynamicSegment(segments[i])) continue;
    const href = HREF_OVERRIDE[segments[i]] ?? "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: formatSegment(segments[i]) });
  }

  // If the URL has more segments than visible crumbs, we're on a detail page
  const onDetailPage = segments.length > crumbs.length;

  // All crumbs including Home and optional entity label
  const allItems: Array<{ href: string; label: string; isPage: boolean }> = [
    { href: "/", label: "Home", isPage: false },
    ...crumbs.map((crumb, i) => ({
      ...crumb,
      // Last static crumb is a page only if we're NOT on a detail page and there's no entity label
      isPage: i === crumbs.length - 1 && !onDetailPage && !entityLabel,
    })),
  ];

  // On detail pages, make all static crumbs links (entity label becomes the page)
  if (onDetailPage) {
    allItems.forEach((item) => { item.isPage = false; });
  }

  // Append entity label as the final page crumb on detail pages
  if (onDetailPage && entityLabel) {
    allItems.push({ href: pathname, label: entityLabel, isPage: true });
  }

  // Collapse logic: when too many crumbs, hide the middle ones behind an ellipsis
  const shouldCollapse = !expanded && allItems.length > COLLAPSE_THRESHOLD;
  const visibleItems = shouldCollapse
    ? [allItems[0], ...allItems.slice(-2)]
    : allItems;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visibleItems.map((item, i) => (
          <span key={item.href + item.label} className="contents">
            {i > 0 && <BreadcrumbSeparator />}
            {/* Insert ellipsis after first item when collapsed */}
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
              {item.isPage ? (
                <BreadcrumbPage className="max-w-[200px] truncate">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="max-w-[200px] truncate">{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
