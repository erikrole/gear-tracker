"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

type ThemePref = "system" | "light" | "dark";

function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as ThemePref | null;
    if (stored && ["system", "light", "dark"].includes(stored)) {
      setThemeState(stored);
      applyTheme(stored);
    }
  }, []);

  function applyTheme(pref: ThemePref) {
    const root = document.documentElement;
    if (pref === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (pref === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
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

  const initials = user
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Brand mark + user profile header */}
      {user && (
        <SidebarHeader className="border-b border-white/[0.08] pb-3 pt-4">
          <SidebarMenu>
            {/* Brand mark — Motion W */}
            <SidebarMenuItem>
              <div className="flex items-center gap-2.5 px-2 pb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <img src="/Badgers.png" alt="Wisconsin" className="size-7 shrink-0 object-contain" />
                <span className="text-[13px] font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden" style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
                  Gear Tracker
                </span>
              </div>
            </SidebarMenuItem>
            {/* User profile */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={user.name}
                className="hover:bg-white/[0.06] active:bg-white/[0.06] data-[active=true]:bg-white/[0.06]"
              >
                <Link href={`/users/${user.id}`} className="flex items-center gap-3">
                  <Avatar className="size-8 shrink-0 border border-white/15 bg-white/10">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-transparent text-white/90 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold text-sidebar-foreground truncate">
                    {user.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      {/* Navigation groups */}
      <SidebarContent className="py-2">
        {navGroups
          .filter((group) => !group.adminOnly || isAdmin)
          .map((group, groupIdx) => (
            <div key={groupIdx}>
              {groupIdx > 0 && (
                <SidebarSeparator className="mx-4 my-1 bg-white/[0.07] group-data-[collapsible=icon]:mx-2" />
              )}
              <SidebarGroup className="px-2 py-0">
                {group.label && (
                  <SidebarGroupLabel className="text-white/30 text-[10px] uppercase tracking-wider px-2 mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const href = item.href;
                    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                    const Icon = item.icon;

                    // Per-item badge count
                    const badgeCount =
                      item.href === "/bookings" && overdueBadgeCount > 0
                        ? overdueBadgeCount
                        : item.href === "/notifications" && unreadNotifications > 0
                        ? unreadNotifications
                        : 0;
                    const badgeLabel = item.badge; // static label like "Soon"

                    // Enrich tooltip with count context for collapsed icon-only mode
                    const tooltip =
                      item.href === "/bookings" && overdueBadgeCount > 0
                        ? `Bookings · ${overdueBadgeCount} overdue`
                        : item.href === "/notifications" && unreadNotifications > 0
                        ? `Notifications · ${unreadNotifications} unread`
                        : item.label;

                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={tooltip}
                          className={
                            isActive
                              ? "border-l-2 border-[var(--wi-red)] rounded-l-none pl-[10px] data-[active=true]:bg-white/[0.10] data-[active=true]:text-white"
                              : "text-white/65 hover:text-white hover:bg-white/[0.06]"
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
                          <SidebarMenuBadge className="bg-white/10 text-white/50 text-[9px] font-semibold h-[16px] flex items-center justify-center rounded px-1 tracking-wide">
                            {badgeLabel}
                          </SidebarMenuBadge>
                        )}
                        {item.quickCreateHref && isAdmin && (
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
      <SidebarFooter className="border-t border-white/[0.08] pt-2 pb-3">
        <div className="px-2">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => { if (v) setTheme(v as ThemePref); }}
            className="group-data-[collapsible=icon]:hidden"
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
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isLoggingOut ? "Logging out…" : "Log out"}
              onClick={onSignOut}
              disabled={isLoggingOut}
              className="text-white/65 hover:text-white hover:bg-white/[0.06] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
