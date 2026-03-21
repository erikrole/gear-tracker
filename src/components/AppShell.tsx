"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SearchIcon, ClipboardCheckIcon, CalendarCheckIcon, BellIcon, UserIcon, LayoutGridIcon, LayersIcon, CalendarPlusIcon, ScanIcon, MenuIcon } from "lucide-react";
import Sidebar from "./Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";

type User = { name: string; email: string; role: string; avatarUrl?: string | null };

type SearchResult = {
  type: "item" | "checkout" | "reservation";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  // Item-specific fields for status display
  computedStatus?: string;
  activeBooking?: { requesterName: string; isOverdue: boolean } | null;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((json) => setUser(json.user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));

    // Fetch unread notification count
    fetch("/api/notifications?limit=0&unread=true")
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.unreadCount != null) setUnreadNotifications(json.unreadCount); })
      .catch(() => {});
  }, [router, pathname]);

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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
        const [itemsRes, checkoutsRes, reservationsRes] = await Promise.all([
          fetch(`/api/assets?q=${encoded}&limit=5`, { signal: controller.signal }),
          fetch(`/api/checkouts?q=${encoded}&limit=5`, { signal: controller.signal }),
          fetch(`/api/reservations?q=${encoded}&limit=5`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const merged: SearchResult[] = [];
        if (itemsRes.ok) {
          const json = await itemsRes.json();
          for (const item of (json.data || []).slice(0, 5)) {
            merged.push({
              type: "item", id: item.id,
              title: item.assetTag,
              subtitle: "",
              href: `/items/${item.id}`,
              computedStatus: item.computedStatus,
              activeBooking: item.activeBooking ? { requesterName: item.activeBooking.requesterName, isOverdue: item.activeBooking.isOverdue } : null,
            });
          }
        }
        if (checkoutsRes.ok) {
          const json = await checkoutsRes.json();
          for (const b of (json.data || []).slice(0, 5)) {
            merged.push({ type: "checkout", id: b.id, title: b.title, subtitle: b.requester?.name || "", href: `/checkouts/${b.id}` });
          }
        }
        if (reservationsRes.ok) {
          const json = await reservationsRes.json();
          for (const b of (json.data || []).slice(0, 5)) {
            merged.push({ type: "reservation", id: b.id, title: b.title, subtitle: b.requester?.name || "", href: `/reservations/${b.id}` });
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

  function handleCmdSelect(href: string) {
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
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
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
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Command palette */}
      <CommandDialog open={cmdOpen} onOpenChange={(open) => { setCmdOpen(open); if (!open) { setCmdQuery(""); setCmdResults([]); } }}>
        <CommandInput placeholder="Search items, checkouts, reservations..." value={cmdQuery} onValueChange={setCmdQuery} />
        <CommandList>
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
                const statusLabel = isOverdue ? `Checked out by ${r.activeBooking?.requesterName}`
                  : status === "CHECKED_OUT" ? `Checked out by ${r.activeBooking?.requesterName}`
                  : status === "RESERVED" ? `Reserved by ${r.activeBooking?.requesterName}`
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

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSignOut={handleLogout} />
      {!online && (
        <div className="offline-banner" role="status">
          You're offline. Changes will sync when connected.
        </div>
      )}
      <main className="app-main">
        <header className="topbar">
          <button
            className="mobile-nav-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          {/* Search trigger (desktop + mobile) */}
          <button
            className="topbar-search topbar-search-desktop"
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
                className="topbar-search-mobile topbar-icon-btn"
                onClick={() => setCmdOpen(true)}
              >
                <SearchIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search (⌘K)</TooltipContent>
          </Tooltip>
          <div className="topbar-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="topbar-icon-btn" asChild>
                  <Link href="/notifications">
                    <BellIcon className="size-5" />
                    {unreadNotifications > 0 && (
                      <span className="topbar-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
                    )}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="topbar-icon-btn" asChild>
                  <Link href="/profile">
                    <UserIcon className="size-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Profile</TooltipContent>
            </Tooltip>
          </div>
        </header>
        <div id="main-content" className="page-content">
          <PageBreadcrumb />
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item${isActive ? " active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
