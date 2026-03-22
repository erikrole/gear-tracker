"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

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
  events: "Events",
  "bulk-inventory": "Bulk Inventory",
  "calendar-sources": "Calendar Sources",
  database: "Database",
  categories: "Categories",
  escalation: "Escalation",
  sports: "Sports",
  utilization: "Utilization",
  overdue: "Overdue",
  scans: "Scans",
  audit: "Audit",
};

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
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumb on the home page
  if (segments.length === 0) return null;

  // Build crumbs, filtering out dynamic segments (IDs)
  const crumbs: Array<{ href: string; label: string }> = [];
  for (let i = 0; i < segments.length; i++) {
    if (isDynamicSegment(segments[i])) continue;
    const href = "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: formatSegment(segments[i]) });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
