"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_SECTIONS, isSectionVisible } from "@/lib/nav-sections";
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
    : SETTINGS_SECTIONS;

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

      <nav className="mb-6 overflow-x-auto rounded-lg border bg-card/60 p-1 shadow-xs" aria-label="Settings sections">
        <div className="flex min-w-max gap-1">
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium no-underline transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pathname === "/settings"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            Overview
          </Link>
          {visibleSections.map((s, i) => {
            const prev = i > 0 ? visibleSections[i - 1] : null;
            const newGroup = prev && prev.group !== s.group;
            return (
              <div key={s.href} className="flex items-stretch gap-1">
                {newGroup && <span className="self-center mx-1.5 h-4 w-px bg-border" aria-hidden />}
                <Link
                  href={s.href}
                  title={s.description}
                  aria-current={pathname.startsWith(s.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium no-underline transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    pathname.startsWith(s.href)
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              </div>
            );
          })}
        </div>
      </nav>

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
    </>
  );
}
