"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SearchIcon, ClipboardCheckIcon, CalendarCheckIcon, BellIcon, UserIcon, LayoutGridIcon, LayersIcon, CalendarPlusIcon, ScanIcon, ArrowRightIcon } from "lucide-react";
import AppSidebar from "./Sidebar";
import { AssetImage } from "@/components/AssetImage";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { STATUS_STYLES } from "@/lib/status-styles";
import { type CurrentUser, useCurrentUser } from "@/hooks/use-current-user";
import { handleAuthRedirect, parseJsonSafely } from "@/lib/errors";
import { getVisiblePageSearchResults, type PageSearchResult } from "@/lib/search-pages";
import { assetSearchTitle } from "@/lib/search-result-title";
import { cn } from "@/lib/utils";

type EntitySearchResult = {
  type: "item" | "checkout" | "reservation" | "user";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string | null;
  // Item-specific fields for status display
  computedStatus?: string;
  activeBooking?: { requesterName: string; isOverdue: boolean; endsAt?: string } | null;
};

type SearchResult = EntitySearchResult | PageSearchResult;

type ApiSearchList<T> = {
  data?: T[];
};

type AssetSearchItem = {
  id: string;
  assetTag?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  type?: string | null;
  imageUrl?: string | null;
  computedStatus?: string | null;
  activeBooking?: {
    requesterName?: string | null;
    isOverdue?: boolean | null;
    endsAt?: string | null;
  } | null;
};

type BookingSearchItem = {
  id: string;
  title?: string | null;
  requester?: { name?: string | null } | null;
};

type UserSearchItem = {
  id: string;
  name?: string | null;
  email?: string | null;
};

type NotificationCountResponse = {
  unreadCount?: unknown;
};

type DashboardStatsBadgeResponse = {
  data?: {
    myOverdueCount?: unknown;
  };
};

const bottomNavItems = [
  { label: "Home", href: "/", icon: LayoutGridIcon },
  { label: "Items", href: "/items", icon: LayersIcon },
  { label: "Reservations", href: "/reservations", icon: CalendarPlusIcon },
  { label: "Checkouts", href: "/checkouts", icon: ClipboardCheckIcon, badge: "overdue" as const },
  { label: "Lookup", href: "/scan", icon: ScanIcon, primary: true },
];

export default function AppShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: CurrentUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useCurrentUser(initialUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [overdueBadgeCount, setOverdueBadgeCount] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, router, user]);

  // Badge counts — refresh on navigation so counts stay fresh after user actions
  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    async function loadBadgeCounts() {
      try {
        const [notificationsResult, dashboardResult] = await Promise.allSettled([
          fetch("/api/notifications?limit=0&unread=true", { signal: controller.signal }),
          fetch("/api/dashboard/stats", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;

        if (notificationsResult.status === "fulfilled") {
          if (handleAuthRedirect(notificationsResult.value, pathname)) return;
          if (notificationsResult.value.ok) {
            const json = await parseJsonSafely<NotificationCountResponse>(notificationsResult.value);
            if (typeof json?.unreadCount === "number") {
              setUnreadNotifications(json.unreadCount);
            }
          }
        }

        if (dashboardResult.status === "fulfilled") {
          if (handleAuthRedirect(dashboardResult.value, pathname)) return;
          if (dashboardResult.value.ok) {
            const json = await parseJsonSafely<DashboardStatsBadgeResponse>(dashboardResult.value);
            const count = json?.data?.myOverdueCount;
            // User-scoped overdue count so STUDENT sees only their own overdue
            if (typeof count === "number") {
              setOverdueBadgeCount(count);
            }
          }
        }
      } catch {
        // Badge counts are ambient chrome; keep the last known values on failure.
      }
    }

    loadBadgeCounts();

    return () => { controller.abort(); };
  }, [pathname, user]);

  // Command palette state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdResults, setCmdResults] = useState<SearchResult[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const [cmdError, setCmdError] = useState<"network" | "server" | null>(null);
  const [cmdPartialFailures, setCmdPartialFailures] = useState(0);
  const cmdAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live search when query changes
  useEffect(() => {
    const q = cmdQuery.trim();
    if (!q) { setCmdResults([]); setCmdLoading(false); setCmdError(null); setCmdPartialFailures(0); return; }

    setCmdLoading(true);
    setCmdError(null);
    setCmdPartialFailures(0);
    cmdAbortRef.current?.abort();
    const controller = new AbortController();
    cmdAbortRef.current = controller;

    const timer = setTimeout(async () => {
      const encoded = encodeURIComponent(q);
      try {
        const [itemsRes, checkoutsRes, reservationsRes, usersRes] = await Promise.allSettled([
          fetch(`/api/assets?q=${encoded}&limit=8`, { signal: controller.signal }),
          fetch(`/api/checkouts?q=${encoded}&status_in=OPEN,PENDING_PICKUP&limit=8`, { signal: controller.signal }),
          fetch(`/api/reservations?q=${encoded}&status=BOOKED&limit=8`, { signal: controller.signal }),
          fetch(`/api/users?q=${encoded}&limit=5`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const merged: SearchResult[] = getVisiblePageSearchResults(user?.role, q);
        let failures = 0;
        if (itemsRes.status === "fulfilled" && handleAuthRedirect(itemsRes.value, pathname)) return;
        if (checkoutsRes.status === "fulfilled" && handleAuthRedirect(checkoutsRes.value, pathname)) return;
        if (reservationsRes.status === "fulfilled" && handleAuthRedirect(reservationsRes.value, pathname)) return;
        if (usersRes.status === "fulfilled" && handleAuthRedirect(usersRes.value, pathname)) return;

        if (itemsRes.status === "fulfilled" && itemsRes.value.ok) {
          const json = await parseJsonSafely<ApiSearchList<AssetSearchItem>>(itemsRes.value);
          const data = json?.data;
          if (!data) failures += 1;
          for (const item of (data ?? []).slice(0, 8)) {
            merged.push({
              type: "item", id: item.id,
              title: assetSearchTitle(item),
              subtitle: "",
              href: `/items/${item.id}`,
              imageUrl: item.imageUrl ?? null,
              computedStatus: item.computedStatus ?? undefined,
              activeBooking: item.activeBooking ? { requesterName: item.activeBooking.requesterName ?? "", isOverdue: !!item.activeBooking.isOverdue, endsAt: item.activeBooking.endsAt ?? undefined } : null,
            });
          }
        } else {
          failures += 1;
        }
        if (checkoutsRes.status === "fulfilled" && checkoutsRes.value.ok) {
          const json = await parseJsonSafely<ApiSearchList<BookingSearchItem>>(checkoutsRes.value);
          const data = json?.data;
          if (!data) failures += 1;
          for (const b of (data ?? []).slice(0, 8)) {
            merged.push({ type: "checkout", id: b.id, title: b.title ?? "Untitled checkout", subtitle: b.requester?.name || "", href: `/checkouts/${b.id}` });
          }
        } else {
          failures += 1;
        }
        if (reservationsRes.status === "fulfilled" && reservationsRes.value.ok) {
          const json = await parseJsonSafely<ApiSearchList<BookingSearchItem>>(reservationsRes.value);
          const data = json?.data;
          if (!data) failures += 1;
          for (const b of (data ?? []).slice(0, 8)) {
            merged.push({ type: "reservation", id: b.id, title: b.title ?? "Untitled reservation", subtitle: b.requester?.name || "", href: `/reservations/${b.id}` });
          }
        } else {
          failures += 1;
        }
        if (usersRes.status === "fulfilled" && usersRes.value.ok) {
          const json = await parseJsonSafely<ApiSearchList<UserSearchItem>>(usersRes.value);
          const data = json?.data;
          if (!data) failures += 1;
          for (const u of (data ?? []).slice(0, 5)) {
            merged.push({ type: "user", id: u.id, title: u.name ?? "Unnamed user", subtitle: u.email || "", href: `/users/${u.id}` });
          }
        } else {
          failures += 1;
        }
        if (!controller.signal.aborted) {
          setCmdResults(merged);
          setCmdPartialFailures(failures);
          setCmdError(failures === 4 && merged.length === 0 ? "server" : null);
          setCmdLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) { setCmdResults([]); setCmdError("network"); setCmdLoading(false); }
      }
    }, 200);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [cmdQuery, pathname, user?.role]);

  // Recent searches (localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recent-searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function addRecentSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem("recent-searches", JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  function handleCmdSelect(href: string) {
    if (cmdQuery.trim()) addRecentSearch(cmdQuery.trim());
    setCmdOpen(false);
    setCmdQuery("");
    setCmdResults([]);
    router.push(href);
  }

  // Offline detection
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <a href="#main-content" className="absolute -top-[100px] left-4 z-[var(--z-sidebar)] px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-[var(--radius)] font-[var(--weight-semibold)] text-[var(--text-base)] no-underline transition-[top] duration-200 focus:top-4">Skip to content</a>

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={(open) => { setCmdOpen(open); if (!open) { setCmdQuery(""); setCmdResults([]); setCmdError(null); setCmdPartialFailures(0); } }}>
        <CommandInput placeholder="Search tag, borrower, page, setting, report..." value={cmdQuery} onValueChange={setCmdQuery} />
        <CommandList>
          {!cmdQuery.trim() && recentSearches.length > 0 && (
            <CommandGroup heading="Recent searches">
              {recentSearches.map((q) => (
                <CommandItem key={q} value={q} onSelect={() => { setCmdQuery(q); }}>
                  <SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                  {q}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {cmdLoading && <div className="py-4 text-center text-sm text-muted-foreground" role="status" aria-live="polite">Searching...</div>}
          {!cmdLoading && cmdError && cmdQuery.trim() && (
            <CommandEmpty>{cmdError === "network" ? "Search is offline. Check your connection and try again." : "Search is temporarily unavailable. Try the page shortcut or search again."}</CommandEmpty>
          )}
          {!cmdLoading && !cmdError && cmdQuery.trim() && cmdResults.length === 0 && (
            <CommandEmpty>No matches. Try a tag, borrower, page name, setting, or report.</CommandEmpty>
          )}
          {!cmdLoading && !cmdError && cmdPartialFailures > 0 && cmdResults.length > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground" role="status">
              Some result types could not load. Showing available matches.
            </div>
          )}
          {cmdResults.filter((r) => r.type === "page").length > 0 && (
            <CommandGroup heading="Go to">
              {cmdResults.filter((r): r is PageSearchResult => r.type === "page").map((r) => (
                <CommandItem key={r.id} value={`${r.title} ${r.subtitle} ${r.href} ${r.keywords.join(" ")}`} onSelect={() => handleCmdSelect(r.href)} className="gap-3">
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {cmdResults.filter((r) => r.type === "item").length > 0 && (
            <CommandGroup heading="Items">
              {cmdResults.filter((r): r is EntitySearchResult => r.type === "item").map((r) => {
                const status = r.computedStatus ?? "AVAILABLE";
                const isOverdue = r.activeBooking?.isOverdue ?? false;
                const badgeStyle = isOverdue ? STATUS_STYLES.red.badge
                  : status === "CHECKED_OUT" ? STATUS_STYLES.blue.badge
                  : status === "RESERVED" ? STATUS_STYLES.purple.badge
                  : status === "MAINTENANCE" ? STATUS_STYLES.orange.badge
                  : status === "RETIRED" ? STATUS_STYLES.gray.badge
                  : STATUS_STYLES.green.badge;
                const dueLabel = r.activeBooking?.endsAt
                  ? ` · Due ${new Date(r.activeBooking.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "";
                const statusLabel = isOverdue ? `Overdue — ${r.activeBooking?.requesterName}${dueLabel}`
                  : status === "CHECKED_OUT" ? [r.activeBooking?.requesterName ?? "Checked out", dueLabel.replace(/^ · /, "")].filter(Boolean).join(" · ")
                  : status === "RESERVED" ? `Reserved — ${r.activeBooking?.requesterName ?? "scheduled"}${dueLabel}`
                  : status === "MAINTENANCE" ? "In maintenance"
                  : status === "RETIRED" ? "Retired"
                  : "Available";
                return (
                  <CommandItem key={r.id} value={r.title} onSelect={() => handleCmdSelect(r.href)} className="gap-3">
                    <AssetImage src={r.imageUrl} alt={r.title} size={32} className="rounded" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="mt-0.5">
                        <Badge className={badgeStyle} size="sm">{statusLabel}</Badge>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {cmdResults.filter((r) => r.type === "checkout").length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Checkouts">
                {cmdResults.filter((r): r is EntitySearchResult => r.type === "checkout").map((r) => (
                  <CommandItem key={r.id} value={`${r.title} ${r.subtitle}`} onSelect={() => handleCmdSelect(r.href)}>
                    <ClipboardCheckIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      {r.subtitle && <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {cmdResults.filter((r) => r.type === "reservation").length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Reservations">
                {cmdResults.filter((r): r is EntitySearchResult => r.type === "reservation").map((r) => (
                  <CommandItem key={r.id} value={`${r.title} ${r.subtitle}`} onSelect={() => handleCmdSelect(r.href)}>
                    <CalendarCheckIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      {r.subtitle && <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {cmdResults.filter((r) => r.type === "user").length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Users">
                {cmdResults.filter((r): r is EntitySearchResult => r.type === "user").map((r) => (
                  <CommandItem key={r.id} value={`${r.title} ${r.subtitle}`} onSelect={() => handleCmdSelect(r.href)}>
                    <UserIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      {r.subtitle && <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {cmdQuery.trim() && cmdResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => handleCmdSelect(`/search?q=${encodeURIComponent(cmdQuery.trim())}`)}>
                  <SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
                  See all results for &ldquo;{cmdQuery.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>

      <AppSidebar
        user={user}
        onSignOut={handleLogout}
        isLoggingOut={loggingOut}
        overdueBadgeCount={overdueBadgeCount}
        unreadNotifications={unreadNotifications}
      />

      {!online && (
        <div className="fixed top-0 left-0 right-0 z-[var(--z-offline)] bg-[var(--orange)] text-black text-center px-4 py-1.5 text-[var(--text-sm)] font-[var(--weight-semibold)]" role="status">
          You&apos;re offline. Changes will sync when connected.
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 max-md:pl-[env(safe-area-inset-left,0px)] max-md:pr-[env(safe-area-inset-right,0px)] print:ml-0">
        <header className="h-12 bg-card border-b border-black/[0.06] flex items-center px-6 gap-3 sticky top-0 z-10 max-md:px-3 max-md:gap-2 print:hidden">
          <SidebarTrigger className="shrink-0 text-foreground hover:bg-card hover:text-foreground" />
          {/* Search trigger (desktop + mobile) */}
          <button
            className="flex-1 max-w-[400px] flex items-center gap-2 w-full py-2 px-3 border border-border rounded-lg bg-background cursor-pointer transition-colors text-[13px] text-muted-foreground hover:border-primary max-md:hidden [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
            onClick={() => setCmdOpen(true)}
            type="button"
            aria-label="Search items, checkouts, reservations, users (⌘K)"
          >
            <SearchIcon className="size-4" />
            <span>Search... (⌘K)</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden max-md:flex relative p-2 no-underline text-muted-foreground rounded-lg transition-colors hover:bg-black/5 hover:text-foreground max-md:p-2.5 max-md:min-w-[44px] max-md:min-h-[44px] max-md:items-center max-md:justify-center"
                onClick={() => setCmdOpen(true)}
                aria-label="Search"
              >
                <SearchIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search (⌘K)</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative p-2 no-underline text-muted-foreground rounded-lg transition-colors hover:bg-black/5 hover:text-foreground max-md:p-2.5 max-md:min-w-[44px] max-md:min-h-[44px] max-md:flex max-md:items-center max-md:justify-center [&_a]:no-underline" asChild>
                  <Link href="/notifications" aria-label={unreadNotifications > 0 ? `Notifications (${unreadNotifications} unread)` : "Notifications"}>
                    <BellIcon className="size-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground text-[length:var(--text-2xs)] font-bold rounded-full px-[5px] min-w-4 h-4 leading-4 text-center tabular-nums" aria-hidden="true">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                    )}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative p-2 no-underline text-muted-foreground rounded-lg transition-colors hover:bg-black/5 hover:text-foreground max-md:p-2.5 max-md:min-w-[44px] max-md:min-h-[44px] max-md:flex max-md:items-center max-md:justify-center [&_a]:no-underline" asChild>
                  <Link href={`/users/${user.id}`} aria-label="My profile">
                    <UserIcon className="size-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Profile</TooltipContent>
            </Tooltip>
          </div>
        </header>
        <BreadcrumbProvider>
          <main id="main-content" className="py-7 px-8 flex-1 max-md:p-4 max-md:pb-[calc(96px+env(safe-area-inset-bottom,0px))] print:pb-0">
            <PageBreadcrumb />
            {children}
          </main>
        </BreadcrumbProvider>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-label="Mobile navigation" className="hidden max-md:block fixed inset-x-0 bottom-0 z-[var(--z-overlay)] border-t border-border/70 bg-card/95 px-2 pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.10)] backdrop-blur supports-[backdrop-filter]:bg-card/90 print:hidden">
        <div className="mx-auto grid max-w-[460px] grid-cols-5 gap-1">
          {bottomNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const badgeCount = item.badge === "overdue" ? overdueBadgeCount : 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} overdue` : item.label}
                className={cn(
                  "group relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[9.5px] font-semibold leading-none text-muted-foreground no-underline outline-none transition-[background-color,color,box-shadow,scale] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.96]",
                  isActive && "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
                  item.primary && "gap-0.5",
                )}
              >
                <span
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full transition-[background-color,color,box-shadow,scale] duration-150",
                    item.primary
                      ? isActive
                        ? "bg-[var(--wi-red)] text-white shadow-[0_8px_18px_rgba(160,0,0,0.28)]"
                        : "bg-[var(--wi-red)] text-white shadow-[0_8px_18px_rgba(160,0,0,0.20)] group-hover:shadow-[0_10px_22px_rgba(160,0,0,0.26)]"
                      : isActive
                      ? "bg-[var(--wi-red)]/10 text-[var(--wi-red)]"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden="true"
                >
                  <Icon className={item.primary ? "size-[19px]" : "size-[18px]"} />
                  {badgeCount > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground tabular-nums shadow-sm">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </span>
                <span className={cn("max-w-full truncate tracking-normal", isActive && "text-[var(--wi-red)]", item.primary && isActive && "text-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </SidebarProvider>
  );
}
