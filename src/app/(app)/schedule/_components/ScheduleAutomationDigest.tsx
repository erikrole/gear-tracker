"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CloudAlertIcon,
  ListChecksIcon,
  PackageCheckIcon,
  Repeat2Icon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  ScheduleAutomationCard,
  ScheduleAutomationDigest as ScheduleAutomationDigestType,
} from "@/lib/schedule-automation-types";
import type { ScheduleQueue } from "@/lib/schedule-queues";

type ScheduleAutomationDigestProps = {
  digest: ScheduleAutomationDigestType | null;
  onShowQueue: (queue: ScheduleQueue) => void;
  onOpenTradeBoard: () => void;
};

const ICONS: Record<string, LucideIcon> = {
  staffing: UsersIcon,
  "auto-fill": BotIcon,
  publish: ClipboardCheckIcon,
  risk: PackageCheckIcon,
  sources: CloudAlertIcon,
  cleanup: Repeat2Icon,
};

function cardToneClass(card: ScheduleAutomationCard) {
  switch (card.tone) {
    case "critical":
      return "border-[var(--red-text)]/20 bg-[var(--red-bg)]/20";
    case "attention":
      return "border-[var(--orange-text)]/20 bg-[var(--orange-bg)]/20";
    case "good":
      return "border-[var(--green-text)]/15 bg-[var(--green-bg)]/10";
    case "neutral":
      return "border-border/60 bg-card/80";
  }
}

function iconToneClass(card: ScheduleAutomationCard) {
  switch (card.tone) {
    case "critical":
      return "text-[var(--red-text)]";
    case "attention":
      return "text-[var(--orange-text)]";
    case "good":
      return "text-[var(--green-text)]";
    case "neutral":
      return "text-muted-foreground";
  }
}

export function ScheduleAutomationDigest({
  digest,
  onShowQueue,
  onOpenTradeBoard,
}: ScheduleAutomationDigestProps) {
  const [open, setOpen] = useState(false);

  if (!digest) return null;

  const updatedAt = new Date(digest.generatedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const reviewCount = digest.cards.reduce((sum, card) => {
    if (card.tone === "critical" || card.tone === "attention") return sum + Number(card.value || 0);
    return sum;
  }, 0);
  const quietCards = digest.cards.filter((card) => Number(card.value || 0) === 0).length;
  const leadCards = digest.cards
    .filter((card) => Number(card.value || 0) > 0)
    .slice(0, 3);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="mb-4 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ListChecksIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Automation review</h2>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  reviewCount > 0 ? "bg-[var(--orange-bg)] text-[var(--orange-text)]" : "bg-[var(--green-bg)] text-[var(--green-text)]",
                )}>
                  {reviewCount > 0 ? `${reviewCount} to review` : "Clear"}
                </span>
                {quietCards > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {quietCards} quiet
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Suggestions only. Nothing here changes staffing, publishing, trades, or notifications by itself.
              </p>
            </div>
            <ChevronDownIcon className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )} />
          </CollapsibleTrigger>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-3.5" />
            Updated {updatedAt}
          </div>
        </div>

        {!open && leadCards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {leadCards.map((card) => (
              <span
                key={card.id}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs text-muted-foreground",
                  card.tone === "critical" && "border-[var(--red-text)]/25 bg-[var(--red-bg)]/20 text-[var(--red-text)]",
                  card.tone === "attention" && "border-[var(--orange-text)]/25 bg-[var(--orange-bg)]/20 text-[var(--orange-text)]",
                )}
              >
                {card.label}: {card.value}
              </span>
            ))}
          </div>
        )}

        <CollapsibleContent>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {digest.cards.map((card) => {
          const Icon = ICONS[card.id] ?? ListChecksIcon;
          const action = card.action;
          const className = cn(
            "group min-h-[112px] rounded-lg border px-3 py-2.5 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform]",
            cardToneClass(card),
            action && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          );
          const content = (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                <Icon className={cn("size-3.5", iconToneClass(card))} />
              </div>
              <div className="text-xl font-black leading-none tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {card.value}
              </div>
              <div className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                {card.detail}
              </div>
              {action && (
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary opacity-80 transition-opacity group-hover:opacity-100">
                  {action.label}
                </div>
              )}
            </>
          );

          if (action?.href) {
            return (
              <Link key={card.id} href={action.href} className={className}>
                {content}
              </Link>
            );
          }

          if (action?.queue || action?.openTradeBoard) {
            return (
              <button
                key={card.id}
                type="button"
                className={className}
                onClick={() => {
                  if (action.queue) onShowQueue(action.queue);
                  if (action.openTradeBoard) onOpenTradeBoard();
                }}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={card.id} className={className}>
              {content}
            </div>
          );
            })}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
