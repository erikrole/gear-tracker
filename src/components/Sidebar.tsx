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

const navItems = [
  { label: "Dashboard", href: "/", icon: <LayoutGridIcon /> },
  { label: "Schedule", href: "/schedule", icon: <CalendarIcon /> },
  { label: "Items", href: "/items", icon: <LayersIcon /> },
  { label: "Kits", href: "/kits", icon: <BoxIcon /> },
  { label: "Users", href: "/users", icon: <UsersIcon /> },
  { label: "Reservations", href: "/reservations", icon: <CalendarPlusIcon /> },
  { label: "Checkouts", href: "/checkouts", icon: <ClipboardCheckIcon /> },
  { label: "Scan", href: "/scan", className: "sidebar-scan-nav", icon: <ScanIcon /> },
  { label: "Reports", href: "/reports", icon: <BarChart3Icon /> },
  { label: "Profile", href: "/profile", icon: <UserIcon />, dynamic: true },
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
];

/** Nav items hidden from STUDENT role */
const STUDENT_HIDDEN_HREFS = new Set(["/users", "/kits", "/reports", "/settings"]);

type SidebarProps = {
  user: { id: string; name: string; email: string; role?: string; avatarUrl?: string | null } | null;
  open?: boolean;
  onClose?: () => void;
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

export default function Sidebar({ user, open, onClose, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
      {/* User profile header */}
      {user && (
        <Link href={`/users/${user.id}`} className="sidebar-profile" onClick={onClose}>
          <Avatar className="size-[72px] border-2 border-white/15 bg-white/10 mb-2.5">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-transparent text-white/90 text-[26px] font-semibold">
              {user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="sidebar-profile-name">{user.name}</div>
        </Link>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.filter((item) => !(user?.role === "STUDENT" && STUDENT_HIDDEN_HREFS.has(item.href))).map((item) => {
          const href = (item as { dynamic?: boolean }).dynamic && user?.id
            ? `/users/${user.id}`
            : item.href;
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <Link
              key={item.label}
              href={href}
              className={[isActive ? "active" : "", (item as { className?: string }).className || ""].filter(Boolean).join(" ")}
              onClick={onClose}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="theme-toggle-row">
        <ToggleGroup type="single" value={theme} onValueChange={(v) => { if (v) setTheme(v as ThemePref); }}>
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

      {/* Log out */}
      <button className="sidebar-logout" onClick={onSignOut}>
        <LogOutIcon />
        Log out
      </button>
    </aside>
  );
}
