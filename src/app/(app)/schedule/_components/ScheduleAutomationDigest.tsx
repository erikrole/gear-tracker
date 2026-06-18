import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CloudAlertIcon,
  ListChecksIcon,
  PackageCheckIcon,
  Repeat2Icon,
  UsersIcon,
} from "lucide-react";
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
  if (!digest) return null;

  const updatedAt = new Date(digest.generatedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section className="mb-4 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListChecksIcon className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Automation review</h2>
            <p className="text-xs text-muted-foreground">
              Suggestions only. Nothing here changes staffing, publishing, trades, or notifications by itself.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2Icon className="size-3.5" />
          Updated {updatedAt}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
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
    </section>
  );
}

