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

export default function PageBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumb on the home page
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    // Dynamic segments (UUIDs etc.) — show as "Details"
    const label = segment.match(/^[0-9a-f-]{8,}$/i) ? "Details" : formatSegment(segment);

    return { href, label, isLast };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
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
