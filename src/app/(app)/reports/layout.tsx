"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const REPORT_SECTIONS = [
  { href: "/reports/utilization", label: "Equipment Utilization" },
  { href: "/reports/checkouts", label: "Checkout Activity" },
  { href: "/reports/overdue", label: "Overdue Leaderboard" },
  { href: "/reports/scans", label: "Scan History" },
  { href: "/reports/audit", label: "Audit Trail" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = REPORT_SECTIONS.find((s) => pathname.startsWith(s.href));

  return (
    <>
      <div className="breadcrumb">
        <Link href="/reports">Reports</Link>
        {current && (
          <>
            <span>&rsaquo;</span>
            <span>{current.label}</span>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {REPORT_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`btn btn-sm${pathname.startsWith(s.href) ? " btn-primary" : ""}`}
            style={{
              fontSize: "var(--text-sm)",
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
