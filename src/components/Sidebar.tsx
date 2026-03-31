"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getInitials, getAvatarColor } from "@/lib/avatar";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
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
      // System: resolve to explicit attribute so CSS only needs [data-theme="dark"]
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

  const userInitials = user
    ? getInitials(user.name)
    : "?";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {user && (
        <SidebarHeader className="pb-2 pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2.5 px-2 pb-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <img src="/Badgers.png" alt="Wisconsin" className="size-7 shrink-0 object-contain" />
                <span className="text-[13px] font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
                  Gear Tracker
                </span>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={user.name}
                className="hover:bg-white/[0.06] active:bg-white/[0.06] data-[active=true]:bg-white/[0.06]"
              >
                <Link href={`/users/${user.id}`} className="flex items-center gap-3">
                  <Avatar className="size-8 shrink-0 border border-white/[0.12] bg-white/[0.08]">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-transparent text-white/80 text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-white/90 truncate">
                    {user.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      {/* Navigation groups */}
      <SidebarContent className="py-1">
        {navGroups
          .filter((group) => !group.adminOnly || isAdmin)
          .map((group, groupIdx) => (
            <div key={groupIdx}>
              {groupIdx > 0 && (
                <SidebarSeparator className="mx-3 my-2 bg-white/[0.08] group-data-[collapsible=icon]:mx-2" />
              )}
              <SidebarGroup className="px-2 py-0">
                {group.label && (
                  <SidebarGroupLabel className="text-white/40 text-[11px] uppercase tracking-widest px-2 mb-0.5 font-medium">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="gap-px">
                  {group.items.map((item) => {
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
                              ? "data-[active=true]:bg-[var(--wi-red)]/15 data-[active=true]:text-white font-medium border-l-2 border-l-[var(--wi-red)] transition-all duration-200"
                              : "text-white/50 hover:text-white/90 hover:bg-white/[0.06] font-normal border-l-2 border-l-transparent transition-all duration-200"
                          }
                        >
                          <Link href={href}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {badgeCount > 0 && (
                          <SidebarMenuBadge className="bg-[var(--wi-red)] text-white text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </SidebarMenuBadge>
                        )}
                        {!badgeCount && badgeLabel && (
                          <SidebarMenuBadge className="bg-white/[0.08] text-white/40 text-[9px] font-medium h-[16px] flex items-center justify-center rounded px-1 tracking-wide">
                            {badgeLabel}
                          </SidebarMenuBadge>
                        )}
                        {item.quickCreateHref && isAdmin && !badgeCount && (
                          <SidebarMenuAction asChild showOnHover>
                            <Link href={item.quickCreateHref} aria-label={`New ${item.label.toLowerCase().replace(/s$/, "")}`}>
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

      {/* Footer: theme toggle + logout */}
      <SidebarFooter className="border-t border-white/[0.08] py-2">
        <div className="theme-toggle-row group-data-[collapsible=icon]:hidden">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => { if (v) setTheme(v as ThemePref); }}
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
              className="text-white/40 hover:text-white/80 hover:bg-white/[0.06] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
