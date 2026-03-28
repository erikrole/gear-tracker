"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SearchIcon, ClipboardCheckIcon, CalendarCheckIcon, BellIcon, UserIcon, LayoutGridIcon, LayersIcon, CalendarPlusIcon, ScanIcon } from "lucide-react";
import AppSidebar from "./Sidebar";
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

type User = { id: string; name: string; email: string; role: string; avatarUrl?: string | null };

type SearchResult = {
  type: "item" | "checkout" | "reservation" | "user";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  // Item-specific fields for status display
  computedStatus?: string;
  activeBooking?: { requesterName: string; isOverdue: boolean; endsAt?: string } | null;
};

const bottomNavItems = [
  { label: "Home", href: "/", icon: <LayoutGridIcon className="size-[22px]" /> },
  { label: "Items", href: "/items", icon: <LayersIcon className="size-[22px]" /> },
  { label: "Reservations", href: "/reservations", icon: <CalendarPlusIcon className="size-[22px]" /> },
  { label: "Checkouts", href: "/checkouts", icon: <ClipboardCheckIcon className="size-[22px]" /> },
  { label: "Scan", href: "/scan", icon: <ScanIcon className="size-[22px]" /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [overdueBadgeCount, setOverdueBadgeCount] = useState(0);

  // Auth check — mount only
  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((json) => setUser(json.user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Badge counts — refresh on navigation so counts stay fresh after user actions
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/notifications?limit=0&unread=true", { signal: controller.signal }).then((res) => res.ok ? res.json() : null),
      fetch("/api/dashboard", { signal: controller.signal }).then((res) => res.ok ? res.json() : null),
    ]).then(([notifJson, dashJson]) => {
      if (notifJson?.unreadCount != null) setUnreadNotifications(notifJson.unreadCount);
      // User-scoped overdue count so STUDENT sees only their own overdue
      if (dashJson?.data?.myCheckouts?.overdue != null) setOverdueBadgeCount(dashJson.data.myCheckouts.overdue);
    }).catch(() => {});

    return () => { controller.abort(); };
  }, [pathname]);

  // Command palette state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdResults, setCmdResults] = useState<SearchResult[]>([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const cmdAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }

      // Type-to-search: open palette when user starts typing anywhere
      // Skip if already in an input, or if modifier keys are held (except shift)
      if (cmdOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      // Only trigger on printable single characters
      if (e.key.length === 1 && !e.repeat) {
        setCmdOpen(true);
        setCmdQuery(e.key);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmdOpen]);

  // Live search when query changes
  useEffect(() => {
    const q = cmdQuery.trim();
    if (!q) { setCmdResults([]); setCmdLoading(false); return; }

    setCmdLoading(true);
    cmdAbortRef.current?.abort();
    const controller = new AbortController();
    cmdAbortRef.current = controller;

    const timer = setTimeout(async () => {
      const encoded = encodeURIComponent(q);
      try {
        const [itemsRes, checkoutsRes, reservationsRes, usersRes] = await Promise.all([
          fetch(`/api/assets?q=${encoded}&limit=8`, { signal: controller.signal }),
          fetch(`/api/checkouts?q=${encoded}&limit=8`, { signal: controller.signal }),
          fetch(`/api/reservations?q=${encoded}&limit=8`, { signal: controller.signal }),
          fetch(`/api/users?q=${encoded}&limit=5`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const merged: SearchResult[] = [];
        if (itemsRes.ok) {
          const json = await itemsRes.json();
          for (const item of (json.data || []).slice(0, 8)) {
            merged.push({
              type: "item", id: item.id,
              title: item.assetTag,
              subtitle: "",
              href: `/items/${item.id}`,
              computedStatus: item.computedStatus,
              activeBooking: item.activeBooking ? { requesterName: item.activeBooking.requesterName, isOverdue: item.activeBooking.isOverdue, endsAt: item.activeBooking.endsAt } : null,
            });
          }
        }
        if (checkoutsRes.ok) {
          const json = await checkoutsRes.json();
          for (const b of (json.data || []).slice(0, 8)) {
            merged.push({ type: "checkout", id: b.id, title: b.title, subtitle: b.requester?.name || "", href: `/checkouts/${b.id}` });
          }
        }
        if (reservationsRes.ok) {
          const json = await reservationsRes.json();
          for (const b of (json.data || []).slice(0, 8)) {
            merged.push({ type: "reservation", id: b.id, title: b.title, subtitle: b.requester?.name || "", href: `/reservations/${b.id}` });
          }
        }
        if (usersRes.ok) {
          const json = await usersRes.json();
          for (const u of (json.data || []).slice(0, 5)) {
            merged.push({ type: "user", id: u.id, title: u.name, subtitle: u.email || "", href: `/users/${u.id}` });
          }
        }
        if (!controller.signal.aborted) { setCmdResults(merged); setCmdLoading(false); }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) { setCmdResults([]); setCmdLoading(false); }
      }
    }, 200);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [cmdQuery]);

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
    localStorage.setItem("recent-searches", JSON.stringify(updated));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={(open) => { setCmdOpen(open); if (!open) { setCmdQuery(""); setCmdResults([]); } }}>
        <CommandInput placeholder="Search items, checkouts, reservations, users..." value={cmdQuery} onValueChange={setCmdQuery} />
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
          {cmdLoading && <div className="py-4 text-center text-sm text-muted-foreground">Searching...</div>}
          {!cmdLoading && cmdQuery.trim() && cmdResults.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {cmdResults.filter((r) => r.type === "item").length > 0 && (
            <CommandGroup heading="Items">
              {cmdResults.filter((r) => r.type === "item").map((r) => {
                const status = r.computedStatus ?? "AVAILABLE";
                const isOverdue = r.activeBooking?.isOverdue ?? false;
                const dotClass = isOverdue ? "status-overdue"
                  : status === "CHECKED_OUT" ? "status-checked-out"
                  : status === "RESERVED" ? "status-reserved"
                  : status === "MAINTENANCE" ? "status-maintenance"
                  : status === "RETIRED" ? "status-retired"
                  : "status-available";
                const badgeClass = isOverdue ? "cmd-badge-red"
                  : status === "CHECKED_OUT" ? "cmd-badge-blue"
                  : status === "RESERVED" ? "cmd-badge-purple"
                  : status === "MAINTENANCE" ? "cmd-badge-orange"
                  : status === "RETIRED" ? "cmd-badge-muted"
                  : "cmd-badge-green";
                const dueLabel = r.activeBooking?.endsAt
                  ? ` · Due ${new Date(r.activeBooking.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "";
                const statusLabel = isOverdue ? `Overdue — ${r.activeBooking?.requesterName}${dueLabel}`
                  : status === "CHECKED_OUT" ? `${r.activeBooking?.requesterName}${dueLabel}`
                  : status === "RESERVED" ? `Reserved — ${r.activeBooking?.requesterName}${dueLabel}`
                  : status === "MAINTENANCE" ? "In maintenance"
                  : status === "RETIRED" ? "Retired"
                  : "Available";
                return (
                  <CommandItem key={r.id} value={r.title} onSelect={() => handleCmdSelect(r.href)}>
                    <span className={`status-dot ${dotClass} mr-2.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="mt-0.5">
                        <span className={`cmd-status-badge ${badgeClass}`}>{statusLabel}</span>
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
                {cmdResults.filter((r) => r.type === "checkout").map((r) => (
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
                {cmdResults.filter((r) => r.type === "reservation").map((r) => (
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
                {cmdResults.filter((r) => r.type === "user").map((r) => (
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
        <div className="offline-banner" role="status">
          You&apos;re offline. Changes will sync when connected.
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 max-md:pl-[env(safe-area-inset-left,0px)] max-md:pr-[env(safe-area-inset-right,0px)] print:ml-0">
        <header className="h-12 bg-[var(--panel-solid)] border-b border-black/[0.06] flex items-center px-6 gap-3 sticky top-0 z-10 max-md:px-3 max-md:gap-2 print:hidden">
          <SidebarTrigger className="shrink-0 text-[var(--text)] hover:bg-[var(--panel)] hover:text-[var(--text)]" />
          {/* Search trigger (desktop + mobile) */}
          <button
            className="flex-1 max-w-[400px] flex items-center gap-2 w-full py-2 px-3 border border-border rounded-lg bg-background cursor-pointer transition-colors text-[13px] text-muted-foreground hover:border-[var(--accent)] max-md:hidden [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
            onClick={() => setCmdOpen(true)}
            type="button"
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
                  <Link href="/notifications">
                    <BellIcon className="size-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-[5px] min-w-4 h-4 leading-4 text-center">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                    )}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative p-2 no-underline text-muted-foreground rounded-lg transition-colors hover:bg-black/5 hover:text-foreground max-md:p-2.5 max-md:min-w-[44px] max-md:min-h-[44px] max-md:flex max-md:items-center max-md:justify-center [&_a]:no-underline" asChild>
                  <Link href={`/users/${user.id}`}>
                    <UserIcon className="size-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Profile</TooltipContent>
            </Tooltip>
          </div>
        </header>
        <BreadcrumbProvider>
          <div id="main-content" className="py-7 px-8 flex-1 max-md:p-4 max-md:pb-[calc(80px+env(safe-area-inset-bottom,0px))] print:pb-0">
            <PageBreadcrumb />
            {children}
          </div>
        </BreadcrumbProvider>
      </div>

      {/* Mobile bottom nav */}
      <nav className="hidden max-md:flex fixed bottom-0 left-0 right-0 z-[var(--z-overlay)] bg-[var(--panel-solid)] border-t border-border shadow-[0_-1px_3px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom,4px)] pt-1 justify-around items-stretch print:hidden">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-14 min-h-12 no-underline text-[var(--text-secondary)] text-[11px] font-medium border-none bg-transparent cursor-pointer transition-colors [-webkit-tap-highlight-color:transparent] hover:text-[var(--text)]${isActive ? " !text-[var(--wi-red)]" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </SidebarProvider>
  );
}
