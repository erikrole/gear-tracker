"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Check, ChevronDown, Clock3 } from "lucide-react";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_SECTIONS, REPORT_SECTIONS, meetsRoleRequirement, type SettingsRole } from "@/lib/nav-sections";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

// Only segments where the label diverges from default title-casing.
// Anything else falls through to formatSegment().
const SEGMENT_OVERRIDE: Record<string, { label: string; href?: string }> = {
  events: { label: "Schedule", href: "/schedule" },
  "bulk-inventory": { label: "Bulk Inventory", href: "/items" },
  scan: { label: "Lookup", href: "/scan" },
};

type SiblingItem = {
  href: string;
  label: string;
  requiredRole?: SettingsRole;
  description?: string;
  group?: string;
};

const SIBLING_MAP: Record<string, ReadonlyArray<SiblingItem>> = {
  "/settings": SETTINGS_SECTIONS,
  "/reports": REPORT_SECTIONS,
};
for (const s of SETTINGS_SECTIONS) SIBLING_MAP[s.href] = SETTINGS_SECTIONS;
for (const s of REPORT_SECTIONS) SIBLING_MAP[s.href] = REPORT_SECTIONS;

const COLLAPSE_THRESHOLD = 3;
const RECENT_STORAGE_KEY = "breadcrumb-recent";
const MAX_RECENT_PER_SECTION = 5;
const MAX_RECENT_TOTAL = 30;
const CRUMB_MAX_WIDTH = "max-w-[min(240px,58vw)] sm:max-w-[240px]";
const crumbControlClass = cn(
  "group inline-flex min-h-10 min-w-0 items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground no-underline outline-none",
  "transition-[background-color,color,box-shadow,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]",
  "max-md:min-h-11 max-md:px-2 [&_svg]:size-3.5 [&_svg]:shrink-0",
);
const crumbPageClass = cn(
  "inline-flex min-h-10 min-w-0 items-center rounded-md bg-muted px-2.5 py-1 text-sm font-semibold text-foreground shadow-xs ring-1 ring-border/60",
  "max-md:min-h-11 max-md:px-2 [&_svg]:size-3.5 [&_svg]:shrink-0",
);

type RecentEntity = { href: string; label: string; section: string };

function getRecentEntities(section: string): RecentEntity[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const all: RecentEntity[] = JSON.parse(raw);
    return all.filter((e) => e.section === section).slice(0, MAX_RECENT_PER_SECTION);
  } catch {
    return [];
  }
}

function saveRecentEntity(entity: RecentEntity) {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const all: RecentEntity[] = raw ? JSON.parse(raw) : [];
    if (all[0]?.href === entity.href) return;
    const filtered = all.filter((e) => e.href !== entity.href);
    filtered.unshift(entity);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_TOTAL)));
  } catch {
    // localStorage unavailable
  }
}

function formatSegment(segment: string): string {
  return SEGMENT_OVERRIDE[segment]?.label
    ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isDynamicSegment(segment: string): boolean {
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return true;
  if (/^c[a-z0-9]{20,}$/.test(segment)) return true;
  return false;
}

export default function PageBreadcrumb() {
  const pathname = usePathname();
  const { label: entityLabel } = useBreadcrumbLabel();
  const { data: currentUser } = useCurrentUser();
  const currentUserRole = currentUser?.role ?? "";
  const [expanded, setExpanded] = useState(false);

  // Reset collapse when navigating
  useEffect(() => { setExpanded(false); }, [pathname]);

  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] ?? "";
  const hasDynamicSegment = segments.some(isDynamicSegment);
  const onDetailPage = hasDynamicSegment;

  // Re-read recents only when section changes or after we save a new entity.
  // Empty deps would miss cross-section navigation; keying on firstSegment +
  // entityLabel covers both cases without reading on every render.
  const recentEntities = useMemo(
    () => (onDetailPage ? getRecentEntities(firstSegment) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDetailPage, firstSegment, entityLabel],
  );

  useEffect(() => {
    if (entityLabel && hasDynamicSegment) {
      saveRecentEntity({ href: pathname, label: entityLabel, section: firstSegment });
    }
  }, [entityLabel, pathname, firstSegment, hasDynamicSegment]);

  if (segments.length === 0) return null;

  // Build crumbs, filtering out dynamic segments (IDs)
  const crumbs: Array<{ href: string; label: string }> = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!; // in-bounds by loop condition
    if (isDynamicSegment(seg)) continue;
    const href = SEGMENT_OVERRIDE[seg]?.href ?? "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: formatSegment(seg) });
  }

  const allItems: Array<{ href: string; label: string; isPage: boolean }> = [
    { href: "/", label: "Home", isPage: false },
    ...crumbs.map((crumb, i) => ({
      ...crumb,
      isPage: i === crumbs.length - 1 && !onDetailPage && !entityLabel,
    })),
  ];

  if (onDetailPage && entityLabel) {
    allItems.push({ href: pathname, label: entityLabel, isPage: true });
  }

  const shouldCollapse = !expanded && allItems.length > COLLAPSE_THRESHOLD;
  const visibleItems: typeof allItems = shouldCollapse
    ? [...allItems.slice(0, 1), ...allItems.slice(-2)]
    : allItems;

  const showSkeleton = onDetailPage && !entityLabel;

  return (
    <Breadcrumb className="mb-5 flex min-w-0 items-center print:hidden">
      <BreadcrumbList className="min-w-0 gap-1 rounded-xl border border-border/60 bg-card/70 px-1.5 py-1 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:gap-1">
        {visibleItems.map((item, i) => {
          const hasSiblings = !item.isPage && SIBLING_MAP[item.href] != null;
          const hasRecent = item.isPage && onDetailPage && recentEntities.length > 1;

          return (
            <Fragment key={item.href}>
              {i > 0 && <BreadcrumbSeparator />}
              {shouldCollapse && i === 1 && (
                <>
                  <BreadcrumbItem>
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className={cn(crumbControlClass, "px-2")}
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
                  <BreadcrumbPage className={cn(crumbPageClass, CRUMB_MAX_WIDTH)}>
                    <span className="truncate">{item.label}</span>
                  </BreadcrumbPage>
                ) : hasSiblings ? (
                  <SiblingDropdown
                    currentHref={item.href}
                    label={item.label}
                    siblings={SIBLING_MAP[item.href]!}
                    role={currentUserRole}
                  />
                ) : hasRecent ? (
                  <RecentDropdown
                    currentLabel={item.label}
                    recents={recentEntities}
                    currentHref={pathname}
                  />
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className={cn(crumbControlClass, CRUMB_MAX_WIDTH)}>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
        {showSkeleton && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Skeleton className="h-10 w-32 rounded-md max-md:h-11" />
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SiblingDropdown({
  currentHref,
  label,
  siblings,
  role,
}: {
  currentHref: string;
  label: string;
  siblings: ReadonlyArray<SiblingItem>;
  role: string;
}) {
  const visible = siblings.filter(
    (s) => !s.requiredRole || meetsRoleRequirement(s.requiredRole, role),
  );
  const current = visible.find((s) => s.href === currentHref);
  const menuLabel = current?.group ? `${label}: ${current.group}` : `${label} pages`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(crumbControlClass, CRUMB_MAX_WIDTH)} aria-label={`Open ${label} pages`}>
        <span className="truncate">{label}</span>
        <ChevronDown className="opacity-60 transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {menuLabel}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.map((s) => (
          s.href === currentHref ? (
            <DropdownMenuItem key={s.href} disabled className="items-start gap-2 py-2 data-[disabled]:opacity-100">
              <Check className="mt-0.5 opacity-80" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{s.label}</span>
                {s.description && (
                  <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                    {s.description}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={s.href} asChild className="py-2">
              <Link href={s.href} className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{s.label}</span>
                {s.description && (
                  <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                    {s.description}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      <DropdownMenuTrigger
        className={cn(crumbPageClass, CRUMB_MAX_WIDTH, "gap-1")}
        aria-current="page"
        aria-label="Recently visited in this section"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="opacity-60 transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5">
          <Clock3 />
          Recently visited
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recents.map((r) => (
          r.href === currentHref ? (
            <DropdownMenuItem key={r.href} disabled className="gap-2 py-2 data-[disabled]:opacity-100">
              <Check className="opacity-80" />
              <span className="truncate font-semibold">{r.label}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={r.href} asChild className="py-2">
              <Link href={r.href} className="min-w-0">
                <span className="block truncate">{r.label}</span>
              </Link>
            </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
