"use client";

import { AlertTriangleIcon, WrenchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FlaggedItem } from "../dashboard-types";

type Props = {
  items: FlaggedItem[];
};

const TYPE_CONFIG = {
  DAMAGED: { label: "Damaged", variant: "orange" as const },
  LOST: { label: "Lost", variant: "red" as const },
  MAINTENANCE: { label: "Maintenance", variant: "gray" as const },
};

export function FlaggedItemsBanner({ items }: Props) {
  if (items.length === 0) return null;

  const damaged = items.filter((i) => i.type === "DAMAGED").length;
  const lost = items.filter((i) => i.type === "LOST").length;
  const maintenance = items.filter((i) => i.type === "MAINTENANCE").length;

  const parts: string[] = [];
  if (damaged > 0) parts.push(`${damaged} damaged`);
  if (lost > 0) parts.push(`${lost} lost`);
  if (maintenance > 0) parts.push(`${maintenance} in maintenance`);

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-[var(--radius)] p-3.5 md:px-4 mb-5 animate-[dash-fade-up_0.4s_ease_both]">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {parts.join(", ")} — items needing attention
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.slice(0, 5).map((item) => {
          const cfg = TYPE_CONFIG[item.type];
          return (
            <a
              key={item.id}
              href={`/items/${item.assetId}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-100/60 dark:bg-amber-900/20 no-underline text-inherit transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              {item.type === "MAINTENANCE" ? (
                <WrenchIcon className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <AlertTriangleIcon className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="text-sm font-medium truncate">
                {item.assetTag}
                {item.assetName && ` — ${item.assetName}`}
              </span>
              <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
              {item.bookingTitle && (
                <span className="text-xs text-muted-foreground truncate ml-auto hidden sm:inline">
                  {item.bookingTitle}
                </span>
              )}
            </a>
          );
        })}
        {items.length > 5 && (
          <a href="/items?status=flagged" className="block text-center text-xs text-muted-foreground py-1.5 no-underline transition-colors hover:text-foreground">
            View all {items.length} flagged items &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
