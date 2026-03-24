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
  CalendarPlusIcon,
  ClipboardCheckIcon,
  ScanIcon,
  BarChart3Icon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutGridIcon },
  { label: "Schedule", href: "/schedule", icon: CalendarIcon },
  { label: "Items", href: "/items", icon: LayersIcon },
  { label: "Kits", href: "/kits", icon: BoxIcon },
  { label: "Users", href: "/users", icon: UsersIcon },
  { label: "Reservations", href: "/reservations", icon: CalendarPlusIcon },
  { label: "Checkouts", href: "/checkouts", icon: ClipboardCheckIcon },
  { label: "Scan", href: "/scan", mobileOnly: true, icon: ScanIcon },
  { label: "Reports", href: "/reports", icon: BarChart3Icon },
  { label: "Profile", href: "/profile", icon: UserIcon, dynamic: true },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

/** Nav items hidden from STUDENT role */
const STUDENT_HIDDEN_HREFS = new Set(["/users", "/kits", "/reports", "/settings"]);

type AppSidebarProps = {
  user: { id: string; name: string; email: string; role?: string; avatarUrl?: string | null } | null;
  onSignOut?: () => void;
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

export default function AppSidebar({ user, onSignOut }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const initials = user
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* User profile header */}
      {user && (
        <SidebarHeader className="border-b border-white/[0.08] pb-3 pt-4">
          <SidebarMenu>
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

      {/* Navigation */}
      <SidebarContent className="py-2">
        <SidebarMenu className="px-2 gap-0.5">
          {navItems
            .filter((item) => !(user?.role === "STUDENT" && STUDENT_HIDDEN_HREFS.has(item.href)))
            .filter((item) => !item.mobileOnly)
            .map((item) => {
              const href = item.dynamic && user?.id ? `/users/${user.id}` : item.href;
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
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
                </SidebarMenuItem>
              );
            })}
        </SidebarMenu>
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
              tooltip="Log out"
              onClick={onSignOut}
              className="text-white/65 hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <LogOutIcon />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
