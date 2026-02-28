"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: "Scan",
    href: "/scan",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 010 2H5v2a1 1 0 01-2 0V4zm0 8a1 1 0 012 0v2h2a1 1 0 110 2H4a1 1 0 01-1-1v-3zm10-9a1 1 0 100 2h2v2a1 1 0 102 0V4a1 1 0 00-1-1h-3zm4 9a1 1 0 10-2 0v2h-2a1 1 0 100 2h3a1 1 0 001-1v-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Items",
    href: "/items",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Check-outs",
    href: "/checkouts",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Events",
    href: "/events",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    label: "Labels",
    href: "/labels",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    label: "Import",
    href: "/import",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    )
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    )
  },
  {
    label: "Users",
    href: "/users",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
        <path fillRule="evenodd" d="M5 14a4 4 0 118 0v1a1 1 0 11-2 0v-1a2 2 0 10-4 0v1a1 1 0 11-2 0v-1z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a4 4 0 100 8 4 4 0 000-8zM3 16a7 7 0 1114 0v1a1 1 0 11-2 0v-1a5 5 0 10-10 0v1a1 1 0 11-2 0v-1z" clipRule="evenodd" />
      </svg>
    ),
  }
];

type SidebarProps = {
  user: { name: string; email: string } | null;
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand-wrap">
          <div className="w-logo">W</div>
          <div className="sidebar-brand">Creative</div>
        </div>
      </div>

      <select className="sidebar-location" defaultValue="all">
        <option value="all">All locations</option>
      </select>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main</div>
        {navItems.map((item) => {
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

      {user && (
        <Link href="/profile" className="sidebar-footer" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="sidebar-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-email">{user.email}</div>
          </div>
        </Link>
      )}
    </aside>
  );
}
