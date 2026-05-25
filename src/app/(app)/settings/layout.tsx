"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_GROUP_ORDER,
  SETTINGS_SECTIONS,
  isSectionVisible,
  type SettingsGroup,
  type SettingsSection,
} from "@/lib/nav-sections";
import { SettingsCommand } from "./SettingsCommand";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

const LAST_TAB_STORAGE_KEY = "settings:last-tab";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: currentUser, isLoading } = useCurrentUser();
  const role = currentUser?.role ?? null;

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace("/login");
  }, [currentUser, isLoading, router]);

  const visibleSections = role
    ? SETTINGS_SECTIONS.filter((s) => isSectionVisible(s, role))
    : [];
  const groupedSections = SETTINGS_GROUP_ORDER.map((group) => ({
    group,
    sections: visibleSections.filter((section) => section.group === group),
  })).filter((entry) => entry.sections.length > 0);

  // Remember which sub-tab the user is on, so /settings can resume it next visit.
  useEffect(() => {
    if (pathname === "/settings") return;
    const match = SETTINGS_SECTIONS.find((s) => pathname.startsWith(s.href));
    if (!match) return;
    try {
      localStorage.setItem(LAST_TAB_STORAGE_KEY, match.href);
    } catch {
      // ignore quota / privacy-mode failures
    }
  }, [pathname]);

  // Render shell immediately to avoid blank flicker on every settings nav.
  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-0">
        <PageHeader title="Settings" className="mb-0" />
        <div className="pb-2">
          <SettingsCommand visibleSections={visibleSections} />
        </div>
      </div>

      <nav className="mb-6 overflow-x-auto rounded-lg border bg-card/60 p-1 shadow-xs xl:hidden" aria-label="Settings sections">
        <SettingsTabStrip pathname={pathname} visibleSections={visibleSections} />
      </nav>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[232px_minmax(0,1fr)] xl:items-start">
        <SettingsRail pathname={pathname} groupedSections={groupedSections} />

        <main className="min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-[260px_1fr] gap-8 items-start max-lg:grid-cols-1 max-lg:gap-4">
              <div className="sticky top-20 max-lg:static space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="min-w-0 space-y-3">
                <Skeleton className="h-9 w-full max-w-md" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ) : currentUser ? (
            children
          ) : null}
        </main>
      </div>
    </>
  );
}

function isActiveSection(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function settingsLinkClass(active: boolean) {
  return cn(
    "rounded-md text-sm font-medium no-underline transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active
      ? "bg-background text-foreground shadow-xs"
      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );
}

function SettingsTabStrip({
  pathname,
  visibleSections,
}: {
  pathname: string;
  visibleSections: ReadonlyArray<SettingsSection>;
}) {
  return (
    <div className="flex min-w-max gap-1">
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={cn(settingsLinkClass(pathname === "/settings"), "px-3 py-2")}
      >
        Overview
      </Link>
      {visibleSections.map((section, i) => {
        const prev = i > 0 ? visibleSections[i - 1] : null;
        const newGroup = prev && prev.group !== section.group;
        const active = isActiveSection(pathname, section.href);

        return (
          <div key={section.href} className="flex items-stretch gap-1">
            {newGroup && <span className="self-center mx-1.5 h-4 w-px bg-border" aria-hidden />}
            <Link
              href={section.href}
              title={section.description}
              aria-current={active ? "page" : undefined}
              className={cn(settingsLinkClass(active), "px-3 py-2")}
            >
              {section.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function SettingsRail({
  pathname,
  groupedSections,
}: {
  pathname: string;
  groupedSections: Array<{ group: SettingsGroup; sections: SettingsSection[] }>;
}) {
  return (
    <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-md border bg-card/60 p-2 shadow-xs xl:block">
      <nav aria-label="Settings sections" className="flex flex-col gap-3">
        <div>
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Settings
          </div>
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={cn(settingsLinkClass(pathname === "/settings"), "flex px-2.5 py-2")}
          >
            Overview
          </Link>
        </div>

        {groupedSections.map(({ group, sections }) => (
          <div key={group}>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </div>
            <div className="flex flex-col gap-0.5">
              {sections.map((section) => {
                const active = isActiveSection(pathname, section.href);
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    title={section.description}
                    aria-current={active ? "page" : undefined}
                    className={cn(settingsLinkClass(active), "flex px-2.5 py-2")}
                  >
                    {section.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
