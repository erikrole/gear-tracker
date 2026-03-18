"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const REPORT_SECTIONS = [
  { href: "/reports/utilization", label: "Utilization" },
  { href: "/reports/checkouts", label: "Checkouts" },
  { href: "/reports/overdue", label: "Overdue" },
  { href: "/reports/scans", label: "Scans" },
  { href: "/reports/audit", label: "Audit" },
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

      <div className="page-header mb-0">
        <h1>Reports</h1>
      </div>

      <nav className="item-tabs" style={{ marginBottom: 20 }}>
        {REPORT_SECTIONS.map((s) => (
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
