"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPORT_SECTIONS } from "@/lib/nav-sections";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <h1 className="text-2xl font-bold mb-0">Reports</h1>

      <nav className="flex gap-0 border-b mb-5">
        {REPORT_SECTIONS.map((s) => (
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
