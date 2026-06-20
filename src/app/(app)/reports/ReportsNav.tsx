"use client";

import { usePathname } from "next/navigation";
import { SectionNav, SectionNavLink, SectionNavList } from "@/components/SectionNav";
import { REPORT_SECTIONS } from "@/lib/nav-sections";

export function ReportsNav() {
  const pathname = usePathname();

  return (
    <SectionNav aria-label="Report sections">
      <SectionNavList>
        {REPORT_SECTIONS.map((section) => (
          <SectionNavLink
            key={section.href}
            href={section.href}
            active={pathname.startsWith(section.href)}
          >
            {section.label}
          </SectionNavLink>
        ))}
      </SectionNavList>
    </SectionNav>
  );
}
