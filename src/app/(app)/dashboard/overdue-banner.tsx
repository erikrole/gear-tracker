"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, BellRingIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatOverdueElapsed } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";
import { GearAvatarStack } from "./dashboard-avatars";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { OverdueItem } from "../dashboard-types";
import Link from "next/link";

type Props = {
  overdueCount: number;
  overdueItems: OverdueItem[];
  now: Date;
  onSelectBooking: (id: string) => void;
  canAction?: boolean;
};

export function OverdueBanner({ overdueCount, overdueItems, now, onSelectBooking, canAction = true }: Props) {
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const nudgeBusyRef = useRef(false);

  async function handleNudge(bookingId: string) {
    if (nudgeBusyRef.current) return;
    nudgeBusyRef.current = true;
    setNudgingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/nudge`, { method: "POST" });
      if (handleAuthRedirect(res, "/")) return;
      if (!res.ok) {
        const message = await parseErrorMessage(res, "Failed to send nudge");
        toast.error(message);
        return;
      }
      setNudgedIds((prev) => new Set(prev).add(bookingId));
      toast.success("Nudge sent");
    } catch {
      toast.error("Network error. Couldn't send nudge.");
    } finally {
      nudgeBusyRef.current = false;
      setNudgingId(null);
    }
  }

  if (overdueCount === 0) return null;

  return (
    <div className="relative border border-[var(--wi-red)]/25 bg-[var(--wi-red)]/[0.06] dark:bg-[var(--wi-red)]/[0.10] rounded-lg mb-4 overflow-hidden animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--wi-red)]" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--wi-red)]/15">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="size-3.5 text-[var(--wi-red)] shrink-0" />
          <span
            className="size-1.5 rounded-full bg-[var(--wi-red)] shrink-0 animate-[pulse-dot-anim_2s_ease-in-out_infinite] motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--wi-red)] font-semibold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {overdueCount} overdue checkout{overdueCount !== 1 ? "s" : ""}
          </span>
        </div>
        <Link
          href="/checkouts?filter=overdue"
          className="text-[10.5px] text-muted-foreground/60 hover:text-muted-foreground no-underline transition-colors whitespace-nowrap shrink-0"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {overdueCount === 1 ? "Resolve →" : "Resolve all →"}
        </Link>
      </div>

      {/* Item rows */}
      <div className="flex flex-col">
        {overdueItems.map((item) => (
          <div
            key={item.bookingId}
            className="flex items-center gap-2.5 px-4 py-2.5 text-inherit w-full transition-colors hover:bg-[var(--wi-red)]/[0.07] border-b border-[var(--wi-red)]/10 last:border-b-0"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col gap-0.5 border-0 bg-transparent p-0 text-left"
              onClick={() => onSelectBooking(item.bookingId)}
              aria-label={`Open overdue checkout ${item.bookingTitle}`}
            >
              <span className="truncate text-sm font-semibold">
                {item.bookingTitle}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <UserAvatar name={item.requesterName} avatarUrl={item.requesterAvatarUrl} />
                <span className="truncate">{item.requesterName}</span>
                {(item.items.length > 0 || item.assetTags.length > 0) && (
                  <span aria-hidden="true">/</span>
                )}
                {item.items.length > 0 && (
                  <span className="hidden sm:inline-flex">
                    <GearAvatarStack items={item.items} totalCount={item.assetTags.length} />
                  </span>
                )}
                {item.items.length === 0 && item.assetTags.length > 0 && (
                  <span className="hidden max-w-48 truncate sm:inline">
                    {item.assetTags.join(", ")}
                  </span>
                )}
                <span className="shrink-0 text-[11px] font-bold bg-[var(--wi-red)]/15 text-[var(--wi-red)] px-2 py-0.5 rounded-full tabular-nums">
                  {formatOverdueElapsed(item.endsAt, now)}
                </span>
              </span>
            </button>
            {canAction && (
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-8 text-[var(--wi-red)]/60 hover:text-[var(--wi-red)] hover:bg-[var(--wi-red)]/10"
                      asChild
                    >
                      <Link
                        href={`/checkouts/${item.bookingId}`}
                        aria-label={`Open ${item.bookingTitle}`}
                      >
                        <ExternalLinkIcon className="size-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open checkout</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-8 text-[var(--wi-red)]/60 hover:text-[var(--wi-red)] hover:bg-[var(--wi-red)]/10"
                      disabled={nudgedIds.has(item.bookingId) || nudgingId === item.bookingId}
                      onClick={() => handleNudge(item.bookingId)}
                      aria-label={`Nudge ${item.requesterName}`}
                    >
                      {nudgingId === item.bookingId ? (
                        <Spinner />
                      ) : nudgedIds.has(item.bookingId) ? (
                        <CheckIcon className="size-4 text-green-500" />
                      ) : (
                        <BellRingIcon className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {nudgedIds.has(item.bookingId) ? "Nudge sent" : `Nudge ${item.requesterName}`}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
