"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_SECTIONS = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/escalation", label: "Escalation" },
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

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`btn btn-sm${pathname.startsWith(s.href) ? " btn-primary" : ""}`}
            style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: 8,
              textDecoration: "none",
              ...(!pathname.startsWith(s.href)
                ? { background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }
                : {}),
            }}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {children}
    </>
  );
}
