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
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-[var(--radius)] p-4 mb-4 animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangleIcon className="size-4 text-red-600 dark:text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-900 dark:text-red-200">
          {totalLost} battery unit{totalLost !== 1 ? "s" : ""} currently lost
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={item.skuName}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100/60 dark:bg-red-900/20"
          >
            <span className="text-sm font-medium truncate flex-1">
              {item.skuName}
            </span>
            <Badge variant="red" size="sm">
              {item.count} lost
            </Badge>
          </div>
        ))}
      </div>
      <Link
        href="/bulk-inventory"
        className="block text-center text-xs text-muted-foreground py-1.5 mt-1 no-underline transition-colors hover:text-foreground"
      >
        View in Bulk Inventory &rarr;
      </Link>
    </div>
  );
}
