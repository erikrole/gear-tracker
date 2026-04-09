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
    <div className="bg-amber-50 dark:bg-amber-500/[0.12] border border-amber-500/20 rounded-lg p-4 mb-4 animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-foreground">
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/[0.08] no-underline text-inherit transition-colors hover:bg-amber-500/[0.15] focus-visible:outline-2 focus-visible:outline-ring"
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
