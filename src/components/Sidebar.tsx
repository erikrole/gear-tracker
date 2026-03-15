"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/events",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    label: "Items",
    href: "/items",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "Kits",
    href: "/kits",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    label: "Checkouts",
    href: "/checkouts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Scan",
    href: "/scan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="12" y1="7" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

/** Nav items hidden from STUDENT role */
const STUDENT_HIDDEN_HREFS = new Set(["/users", "/kits", "/settings"]);

type SidebarProps = {
  user: { name: string; email: string; role?: string } | null;
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

  function cycleTheme() {
    const next: ThemePref = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
  }

  const themeIcon = theme === "dark" ? "\u{1F319}" : theme === "light" ? "\u2600\uFE0F" : "\u{1F4BB}";
  const themeLabel = theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  return (
    <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
      {/* User profile header */}
      {user && (
        <div className="sidebar-profile">
          <div className="sidebar-avatar-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-profile-name">{user.name}</div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.filter((item) => !(user?.role === "STUDENT" && STUDENT_HIDDEN_HREFS.has(item.href))).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "active" : ""}
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
        <button className="sidebar-logout" onClick={cycleTheme} style={{ marginTop: 0 }}>
          <span>{themeIcon}</span>
          {themeLabel}
        </button>
      </div>

      {/* Log out */}
      <button className="sidebar-logout" onClick={onSignOut}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Log out
      </button>
    </aside>
  );
}
