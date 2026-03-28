"use client";

import { useState } from "react";
import { AlertTriangleIcon, BellRingIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { formatOverdueElapsed } from "@/lib/format";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { OverdueItem } from "../dashboard-types";

type Props = {
  overdueCount: number;
  overdueItems: OverdueItem[];
  now: Date;
  onSelectBooking: (id: string) => void;
};

export function OverdueBanner({ overdueCount, overdueItems, now, onSelectBooking }: Props) {
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  async function handleNudge(e: React.MouseEvent, bookingId: string) {
    e.stopPropagation();
    setNudgingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/nudge`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error ?? "Failed to send nudge");
        return;
      }
      setNudgedIds((prev) => new Set(prev).add(bookingId));
      toast.success("Nudge sent");
    } catch {
      toast.error("Network error — couldn't send nudge");
    } finally {
      setNudgingId(null);
    }
  }

  if (overdueCount === 0) return null;

  return (
    <div className="bg-[var(--wi-red)] rounded-[var(--radius)] p-3.5 md:px-4 mb-5 text-white border-l-4 border-l-[var(--wi-red-hover)] animate-[dash-fade-up_0.4s_ease_both]">
      <div className="flex items-center justify-between gap-3 mb-2.5 max-md:flex-wrap">
        <div className="flex items-center gap-2 text-[var(--text-md)] font-semibold">
          <AlertTriangleIcon className="shrink-0 size-[18px]" />
          <span className="size-2 rounded-full bg-[var(--panel-solid)] shrink-0 animate-[pulse-dot-anim_2s_ease-in-out_infinite]" />
          <strong>{overdueCount} overdue checkout{overdueCount !== 1 ? "s" : ""}</strong>
        </div>
        <a href="/checkouts?filter=overdue" className="text-white/85 text-[var(--text-sm)] font-medium no-underline whitespace-nowrap shrink-0 hover:text-white hover:underline">Resolve all overdue &rarr;</a>
      </div>
      <div className="flex flex-col gap-1.5">
        {overdueItems.map((item) => (
          <button
            key={item.bookingId}
            className="flex flex-col gap-0.5 bg-white/10 border-none rounded-md px-3 py-2 cursor-pointer font-[inherit] text-white text-left w-full transition-colors hover:bg-white/[0.18]"
            onClick={() => onSelectBooking(item.bookingId)}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[var(--text-sm)] font-semibold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.bookingTitle}</span>
              <span className="flex items-center gap-1 text-xs opacity-75 [&_[data-slot=avatar-fallback]]:bg-white/20 [&_[data-slot=avatar-fallback]]:text-white">
                <UserAvatar name={item.requesterName} />
                {item.requesterName}
                {item.items.length > 0 && <> &middot; <GearAvatarStack items={item.items} totalCount={item.assetTags.length} /></>}
                {item.items.length === 0 && item.assetTags.length > 0 && <> &middot; {item.assetTags.join(", ")}</>}
                 &middot; <span className="text-[var(--text-3xs)] font-bold bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">{formatOverdueElapsed(item.endsAt, now)}</span>
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8 text-muted-foreground hover:text-foreground"
                  disabled={nudgedIds.has(item.bookingId) || nudgingId === item.bookingId}
                  onClick={(e) => handleNudge(e, item.bookingId)}
                  aria-label={`Nudge ${item.requesterName}`}
                >
                  {nudgingId === item.bookingId ? (
                    <Loader2Icon className="size-4 animate-spin" />
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
          </button>
        ))}
      </div>
    </div>
  );
}
