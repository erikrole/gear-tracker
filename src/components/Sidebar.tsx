"use client";

import Link from "next/link";
import Image from "next/image";
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
  ScrollTextIcon,
  BarChart3Icon,
  SettingsIcon,
  HelpCircleIcon,
  LogOutIcon,
  BellIcon,
  PlusIcon,
  KeyIcon,
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
      { label: "Guides", href: "/guides", icon: ScrollTextIcon },
      { label: "Licenses", href: "/licenses", icon: KeyIcon },
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

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {user && (
        <SidebarHeader className="pb-0 pt-4">
          {/* ── Brand lockup ── */}
          <div className="flex items-center gap-3 px-4 pb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
            <Image
              src="/Badgers.png"
              alt="Wisconsin Badgers"
              width={28}
              height={28}
              className="size-7 shrink-0 object-contain"
              priority
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p
                className="text-[9.5px] tracking-[0.22em] text-white/60 uppercase leading-none mb-[3px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                UW Athletics
              </p>
              <p
                className="text-[13.5px] text-white leading-none"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}
              >
                Wisconsin Creative
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-3 mb-2 h-px bg-white/[0.07] group-data-[collapsible=icon]:mx-2" />

          {/* ── User card ── */}
          <SidebarMenu className="pb-1 px-2 group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={user.name}
                className="hover:bg-white/[0.05] active:bg-white/[0.05] data-[active=true]:bg-white/[0.05] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
              >
                <Link
                  href={`/users/${user.id}`}
                  className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0"
                >
                  <Avatar className="size-7 shrink-0 ring-1 ring-white/[0.15] bg-white/[0.08] group-data-[collapsible=icon]:mx-auto">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback
                      className="bg-transparent text-white/80 text-[length:var(--text-2xs)] font-bold"
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
                      className="text-[9.5px] text-white/60 truncate leading-tight mt-[2px] uppercase tracking-[0.14em]"
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
              <div className="px-3 py-3 group-data-[collapsible=icon]:px-2">
                {/* Expanded: label flanked by rules */}
                <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <div className="h-px flex-1 bg-white/[0.1]" />
                  <span
                    className="text-[8.5px] uppercase tracking-[0.28em] text-white/70 select-none"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.1]" />
                </div>
                {/* Collapsed: just a rule */}
                <div className="hidden group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:block group-data-[collapsible=icon]:h-px group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:bg-white/[0.12]" />
              </div>
            )}

            <SidebarGroup className="px-2 py-0">
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
                            ? "data-[active=true]:bg-[var(--wi-red)]/12 data-[active=true]:text-white border-l-2 border-l-[var(--wi-red)] rounded-r-md rounded-l-none pl-[calc(0.5rem-2px)] transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96] group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:border-l-transparent group-data-[collapsible=icon]:bg-white/[0.08] group-data-[collapsible=icon]:pl-2!"
                            : "text-white/50 hover:text-white/90 hover:bg-white/[0.055] border-l-2 border-l-transparent rounded-r-md rounded-l-none pl-[calc(0.5rem-2px)] transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96] group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:pl-2!"
                        }
                      >
                        <Link href={href} aria-current={isActive ? "page" : undefined}>
                          <Icon className={isActive ? "text-white" : "text-white/55 group-hover/menu-item:text-white/80"} />
                          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}>
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>

                      {badgeCount > 0 && (
                        <SidebarMenuBadge className="bg-[var(--wi-red)] text-white text-[length:var(--text-2xs)] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
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
                        <SidebarMenuAction
                          asChild
                          showOnHover
                          className="right-1 top-0.5 size-7 text-white/45 transition-[background-color,color,opacity,scale] hover:bg-white/[0.08] hover:text-white active:scale-[0.96]"
                        >
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
        <div className="flex items-center justify-center px-3 py-1 group-data-[collapsible=icon]:hidden">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(v) => {
              if (v) setTheme(v as ThemePref);
            }}
            className="bg-white/[0.06] rounded-md p-0.5"
          >
            {(["light", "dark", "system"] as const).map((val, i) => (
              <ToggleGroupItem
                key={val}
                value={val}
                aria-label={`${val.charAt(0).toUpperCase() + val.slice(1)} theme`}
                className="text-white/60 px-2.5 py-1 text-xs hover:bg-transparent hover:text-white/85 data-[state=on]:bg-white/[0.12] data-[state=on]:text-white/95 data-[state=on]:shadow-none data-[state=on]:rounded"
              >
                {i === 0 ? <SunIcon className="size-3.5" /> : i === 1 ? <MoonIcon className="size-3.5" /> : <MonitorIcon className="size-3.5" />}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Help & support"
              className="text-white/55 transition-[background-color,color,scale] duration-150 hover:bg-white/[0.05] hover:text-white/85 active:scale-[0.96]"
            >
              <a href="mailto:erole@athletics.wisc.edu?subject=Wisconsin%20Creative%20gear-tracker%20help">
                <HelpCircleIcon />
                <span>Help</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isLoggingOut ? "Logging out…" : "Log out"}
              onClick={onSignOut}
              disabled={isLoggingOut}
              className="cursor-pointer text-white/35 transition-[background-color,color,scale] duration-150 hover:bg-white/[0.05] hover:text-white/75 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
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
