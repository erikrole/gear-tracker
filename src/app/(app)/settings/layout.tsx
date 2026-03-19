"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_SECTIONS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/sports", label: "Sports" },
  { href: "/settings/escalation", label: "Escalation" },
  { href: "/settings/calendar-sources", label: "Calendar" },
  { href: "/settings/database", label: "Database" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = SETTINGS_SECTIONS.find((s) => pathname.startsWith(s.href));

  return (
    <>
      <div className="breadcrumb">
        <Link href="/settings">Settings</Link>
        {current && (
          <>
            <span>&rsaquo;</span>
            <span>{current.label}</span>
          </>
        )}
      </div>

      <div className="page-header mb-0">
        <h1>Settings</h1>
      </div>

      <nav className="item-tabs" style={{ marginBottom: 20 }}>
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`item-tab no-underline${pathname.startsWith(s.href) ? " active" : ""}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </>
  );
}
