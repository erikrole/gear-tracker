"use client";

import { usePathname } from "next/navigation";
import { REPORT_SECTIONS } from "@/lib/nav-sections";

/**
 * Print-only title block. On paper the section nav is gone, so without this a
 * printed page is a table of numbers with no indication of which report it is
 * or when it was run.
 */
export function ReportPrintHeader() {
  const pathname = usePathname();
  const section = REPORT_SECTIONS.find((entry) => pathname.startsWith(entry.href));

  return (
    <div className="report-print-header">
      <div className="text-base font-semibold">
        {section ? `${section.label} report` : "Report"}
      </div>
      <div className="text-xs">
        Printed {new Date().toLocaleString()}
      </div>
    </div>
  );
}
