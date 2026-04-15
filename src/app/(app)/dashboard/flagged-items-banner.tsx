"use client";

import Link from "next/link";
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
  if (maintenance > 0) parts.push(`${maintenance} maintenance`);

  return (
    <div className="relative border border-amber-500/20 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] rounded-lg mb-4 overflow-hidden animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-amber-500/15">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400/80 font-semibold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {parts.join(" · ")}
          </span>
        </div>
        <Link
          href="/items?status=flagged"
          className="text-[10.5px] text-muted-foreground/60 hover:text-muted-foreground no-underline transition-colors whitespace-nowrap"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {items.length > 5 ? `+${items.length - 5} more →` : "View all →"}
        </Link>
      </div>

      {/* Item rows */}
      <div className="flex flex-col">
        {items.slice(0, 5).map((item) => {
          const cfg = TYPE_CONFIG[item.type];
          return (
            <Link
              key={item.id}
              href={`/items/${item.assetId}`}
              className="flex items-center gap-2.5 px-4 py-2.5 no-underline text-inherit transition-colors hover:bg-amber-500/[0.07] border-b border-amber-500/10 last:border-b-0"
            >
              {item.type === "MAINTENANCE" ? (
                <WrenchIcon className="size-3.5 text-muted-foreground/50 shrink-0" />
              ) : (
                <AlertTriangleIcon className="size-3.5 text-amber-600/70 dark:text-amber-400/70 shrink-0" />
              )}
              <span
                className="text-[13px] font-semibold truncate min-w-0"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              >
                {item.assetTag}
                {item.assetName && (
                  <span className="font-normal text-muted-foreground ml-1.5">
                    {item.assetName}
                  </span>
                )}
              </span>
              <Badge variant={cfg.variant} size="sm" className="shrink-0">
                {cfg.label}
              </Badge>
              {item.bookingTitle && (
                <span
                  className="text-[10.5px] text-muted-foreground/50 truncate ml-auto hidden sm:inline"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {item.bookingTitle}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
