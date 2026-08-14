"use client";

import { usePathname } from "next/navigation";
import { SectionNav, SectionNavLink, SectionNavList } from "@/components/SectionNav";
import { isReportSectionVisible, REPORT_SECTIONS } from "@/lib/nav-sections";

export function ReportsNav({ role, canViewUsageAnalytics }: { role: string; canViewUsageAnalytics: boolean }) {
  const pathname = usePathname();

  return (
    <SectionNav aria-label="Report sections">
      <SectionNavList>
        {REPORT_SECTIONS.filter((section) => isReportSectionVisible(section, role)).map((section) => (
          <SectionNavLink
            key={section.href}
            href={section.href}
            active={pathname.startsWith(section.href)}
          >
            {section.label}
          </SectionNavLink>
        ))}
        {canViewUsageAnalytics && (
          <SectionNavLink href="/reports/usage" active={pathname.startsWith("/reports/usage")}>
            Usage
          </SectionNavLink>
        )}
      </SectionNavList>
    </SectionNav>
  );
}
