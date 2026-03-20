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

      <nav className="flex gap-0 border-b mb-5">
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`px-4 py-2.5 text-sm font-medium no-underline transition-colors border-b-2 -mb-px ${pathname.startsWith(s.href) ? "text-foreground border-primary font-semibold" : "text-muted-foreground border-transparent hover:text-foreground"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </>
  );
}
