"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LostBulkUnitSummary } from "../dashboard-types";

type Props = {
  items: LostBulkUnitSummary[];
};

export function LostBulkUnitsCard({ items }: Props) {
  if (items.length === 0) return null;

  const totalLost = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="relative border border-[var(--wi-red)]/25 bg-[var(--wi-red)]/[0.04] dark:bg-[var(--wi-red)]/[0.08] rounded-lg mb-4 overflow-hidden animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--wi-red)]" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--wi-red)]/15">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-3.5 text-[var(--wi-red)] shrink-0" />
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--wi-red)] font-semibold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {totalLost} bulk unit{totalLost !== 1 ? "s" : ""} lost
          </span>
        </div>
        <Link
          href="/bulk-inventory"
          className="text-[10.5px] text-muted-foreground/60 hover:text-muted-foreground no-underline transition-colors whitespace-nowrap"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          View all →
        </Link>
      </div>

      {/* Item rows */}
      <div className="flex flex-col">
        {items.map((item) => (
          <div
            key={item.skuName}
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[var(--wi-red)]/10 last:border-b-0"
          >
            <span className="text-sm font-medium truncate flex-1">{item.skuName}</span>
            <Badge variant="red" size="sm">
              {item.count} lost
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
