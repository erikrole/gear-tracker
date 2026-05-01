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
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_SECTIONS, REPORT_SECTIONS, meetsRoleRequirement, type SettingsRole } from "@/lib/nav-sections";
import { useCurrentUser } from "@/hooks/use-current-user";

// Only segments where the label diverges from default title-casing.
// Anything else falls through to formatSegment().
const SEGMENT_OVERRIDE: Record<string, { label: string; href?: string }> = {
  events: { label: "Schedule", href: "/schedule" },
  "bulk-inventory": { label: "Bulk Inventory", href: "/items" },
};

type SiblingItem = { href: string; label: string; requiredRole?: SettingsRole };

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
    if (isDynamicSegment(segments[i])) continue;
    const href = SEGMENT_OVERRIDE[segments[i]]?.href ?? "/" + segments.slice(0, i + 1).join("/");
    crumbs.push({ href, label: formatSegment(segments[i]) });
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
  const visibleItems = shouldCollapse
    ? [allItems[0], ...allItems.slice(-2)]
    : allItems;

  const showSkeleton = onDetailPage && !entityLabel;

  return (
    <Breadcrumb>
      <BreadcrumbList>
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
                    <Link href={item.href} className="max-w-[200px] truncate">{item.label}</Link>
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
              <Skeleton className="h-4 w-24" />
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span className="max-w-[200px] truncate">{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {visible.map((s) => (
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
