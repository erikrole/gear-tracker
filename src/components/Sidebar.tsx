"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getInitials } from "@/lib/avatar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  LayoutGridIcon,
  CalendarIcon,
  LayersIcon,
  BoxIcon,
  UsersIcon,
  BookOpenIcon,
  BarChart3Icon,
  SettingsIcon,
  LogOutIcon,
  BellIcon,
  PlusIcon,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  quickCreateHref?: string;
};

type NavGroup = {
  label?: string;
  adminOnly?: boolean;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: LayoutGridIcon },
      { label: "Schedule", href: "/schedule", icon: CalendarIcon },
      { label: "Items", href: "/items", icon: LayersIcon },
      { label: "Bookings", href: "/bookings", icon: BookOpenIcon, quickCreateHref: "/bookings?create=true" },
      { label: "Notifications", href: "/notifications", icon: BellIcon },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { label: "Kits", href: "/kits", icon: BoxIcon },
      { label: "Users", href: "/users", icon: UsersIcon },
      { label: "Reports", href: "/reports", icon: BarChart3Icon },
      { label: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

type AppSidebarProps = {
  user: { id: string; name: string; email: string; role?: string; avatarUrl?: string | null } | null;
  onSignOut?: () => void;
  isLoggingOut?: boolean;
  overdueBadgeCount?: number;
  unreadNotifications?: number;
};

const THEME_PREFS = ["system", "light", "dark"] as const;
type ThemePref = (typeof THEME_PREFS)[number];

function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored && (THEME_PREFS as readonly string[]).includes(stored)) {
      setThemeState(stored as ThemePref);
      applyTheme(stored as ThemePref);
    }
  }, []);

  function applyTheme(pref: ThemePref) {
    const root = document.documentElement;
    if (pref === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (pref === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }

  function setTheme(pref: ThemePref) {
    setThemeState(pref);
    localStorage.setItem("theme", pref);
    applyTheme(pref);
  }

  return { theme, setTheme };
}

export default function AppSidebar({
  user,
  onSignOut,
  isLoggingOut = false,
  overdueBadgeCount = 0,
  unreadNotifications = 0,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isAdmin = user?.role === "ADMIN" || user?.role === "STAFF";

  const userInitials = user ? getInitials(user.name) : "?";

  const visibleGroups = navGroups.filter((g) => !g.adminOnly || isAdmin);

  // Build label → sequential number map for trailing item indexes
  const itemNumberMap = new Map<string, string>();
  let seq = 1;
  for (const g of visibleGroups) {
    for (const item of g.items) {
      itemNumberMap.set(item.label, String(seq++).padStart(2, "0"));
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {user && (
        <SidebarHeader className="pb-0 pt-4">
          {/* ── Brand lockup ── */}
          <div className="flex items-center gap-3 px-4 pb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
            <img
              src="/Badgers.png"
              alt="Wisconsin Badgers"
              className="size-7 shrink-0 object-contain"
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p
                className="text-[9.5px] tracking-[0.22em] text-white/25 uppercase leading-none mb-[3px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                UW Athletics
              </p>
              <p
                className="text-[13.5px] text-white leading-none"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}
              >
                Gear Tracker
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-3 mb-2 h-px bg-white/[0.07] group-data-[collapsible=icon]:mx-2" />

          {/* ── User card ── */}
          <SidebarMenu className="pb-1 px-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={user.name}
                className="hover:bg-white/[0.05] active:bg-white/[0.05] data-[active=true]:bg-white/[0.05]"
              >
                <Link href={`/users/${user.id}`} className="flex items-center gap-2.5">
                  <Avatar className="size-7 shrink-0 ring-1 ring-white/[0.15] bg-white/[0.08]">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback
                      className="bg-transparent text-white/80 text-[10px] font-bold"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p
                      className="text-[12px] text-white/90 truncate leading-tight"
                      style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
                    >
                      {user.name}
                    </p>
                    <p
                      className="text-[9.5px] text-white/28 truncate leading-tight mt-[2px] uppercase tracking-[0.14em]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {user.role ?? "Student"}
                    </p>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      {/* ── Navigation groups ── */}
      <SidebarContent className="py-1">
        {visibleGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {groupIdx > 0 && (
              <div className="px-3 py-2.5 group-data-[collapsible=icon]:px-2">
                {/* Expanded: label flanked by rules */}
                <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <div className="h-px flex-1 bg-white/[0.07]" />
                  <span
                    className="text-[8.5px] uppercase tracking-[0.28em] text-white/22 select-none"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.07]" />
                </div>
                {/* Collapsed: just a rule */}
                <div className="hidden group-data-[collapsible=icon]:block h-px bg-white/[0.07]" />
              </div>
            )}

            <SidebarGroup className="px-2 py-0">
              <SidebarMenu className="gap-px">
                {group.items.map((item) => {
                  const itemNumber = itemNumberMap.get(item.label)!;
                  const href = item.href;
                  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  const Icon = item.icon;

                  const badgeCfg =
                    href === "/bookings" && overdueBadgeCount > 0
                      ? { count: overdueBadgeCount, suffix: "overdue" }
                      : href === "/notifications" && unreadNotifications > 0
                      ? { count: unreadNotifications, suffix: "unread" }
                      : null;
                  const badgeCount = badgeCfg?.count ?? 0;
                  const badgeLabel = item.badge;
                  const tooltip = badgeCfg
                    ? `${item.label} · ${badgeCfg.count} ${badgeCfg.suffix}`
                    : item.label;

                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={tooltip}
                        className={
                          isActive
                            ? "data-[active=true]:bg-[var(--wi-red)]/10 data-[active=true]:text-white border-l-2 border-l-[var(--wi-red)] rounded-r-md rounded-l-none pl-[calc(0.5rem-2px)] transition-all duration-150"
                            : "text-white/45 hover:text-white/85 hover:bg-white/[0.05] border-l-2 border-l-transparent rounded-r-md rounded-l-none pl-[calc(0.5rem-2px)] transition-all duration-150"
                        }
                      >
                        <Link href={href}>
                          <Icon />
                          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>
                            {item.label}
                          </span>
                          {/* Trailing item index — hidden in collapsed mode */}
                          <span
                            className="ml-auto text-[9px] tabular-nums group-data-[collapsible=icon]:hidden"
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: isActive ? "var(--wi-red)" : "rgba(255,255,255,0.17)",
                            }}
                          >
                            {itemNumber}
                          </span>
                        </Link>
                      </SidebarMenuButton>

                      {badgeCount > 0 && (
                        <SidebarMenuBadge className="bg-[var(--wi-red)] text-white text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                          <span className="sr-only">
                            {badgeCfg!.count} {badgeCfg!.suffix}
                          </span>
                          <span aria-hidden="true">{badgeCount > 99 ? "99+" : badgeCount}</span>
                        </SidebarMenuBadge>
                      )}
                      {!badgeCount && badgeLabel && (
                        <SidebarMenuBadge className="bg-white/[0.08] text-white/40 text-[9px] font-medium h-[16px] flex items-center justify-center rounded px-1 tracking-wide">
                          {badgeLabel}
                        </SidebarMenuBadge>
                      )}
                      {item.quickCreateHref && isAdmin && !badgeCount && (
                        <SidebarMenuAction asChild showOnHover>
                          <Link
                            href={item.quickCreateHref}
                            aria-label={`New ${item.label.toLowerCase().replace(/s$/, "")}`}
                          >
                            <PlusIcon />
                          </Link>
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>

      {/* ── Footer: theme toggle + logout ── */}
      <SidebarFooter className="border-t border-white/[0.07] py-2">
        <div className="theme-toggle-row group-data-[collapsible=icon]:hidden">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => {
              if (v) setTheme(v as ThemePref);
            }}
          >
            <ToggleGroupItem value="light" aria-label="Light theme">
              <SunIcon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark theme">
              <MoonIcon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="System theme">
              <MonitorIcon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isLoggingOut ? "Logging out…" : "Log out"}
              onClick={onSignOut}
              disabled={isLoggingOut}
              className="text-white/35 hover:text-white/75 hover:bg-white/[0.05] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOutIcon />
              <span>{isLoggingOut ? "Logging out…" : "Log out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
