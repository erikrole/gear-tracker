"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPORT_SECTIONS } from "@/lib/nav-sections";
import { cn } from "@/lib/utils";

export function ReportsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 overflow-x-auto rounded-lg border bg-card/60 p-1 shadow-xs" aria-label="Report sections">
      <div className="flex min-w-max gap-1">
        {REPORT_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            aria-current={pathname.startsWith(section.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium no-underline transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pathname.startsWith(section.href)
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
