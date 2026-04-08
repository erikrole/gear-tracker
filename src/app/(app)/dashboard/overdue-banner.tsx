"use client";

import { useState } from "react";
import { AlertTriangleIcon, BellRingIcon, CheckIcon, ClipboardCheckIcon, Loader2Icon } from "lucide-react";
import { formatOverdueElapsed } from "@/lib/format";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/Toast";
import type { OverdueItem } from "../dashboard-types";
import Link from "next/link";

type Props = {
  overdueCount: number;
  overdueItems: OverdueItem[];
  now: Date;
  onSelectBooking: (id: string) => void;
};

export function OverdueBanner({ overdueCount, overdueItems, now, onSelectBooking }: Props) {
  const { toast } = useToast();
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  async function handleNudge(e: React.MouseEvent, bookingId: string) {
    e.stopPropagation();
    setNudgingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/nudge`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error ?? "Failed to send nudge", "error");
        return;
      }
      setNudgedIds((prev) => new Set(prev).add(bookingId));
      toast("Nudge sent", "success");
    } catch {
      toast("Network error — couldn't send nudge", "error");
    } finally {
      setNudgingId(null);
    }
  }

  if (overdueCount === 0) return null;

  return (
    <div className="bg-[var(--wi-red)] rounded-[var(--radius)] p-4 mb-4 text-white border-l-4 border-l-[var(--wi-red-hover)] animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none">
      <div className="flex items-center justify-between gap-3 mb-2.5 max-md:flex-wrap">
        <div className="flex items-center gap-2 text-[var(--text-md)] font-semibold">
          <AlertTriangleIcon className="shrink-0 size-[18px]" />
          <span className="size-2 rounded-full bg-[var(--panel-solid)] shrink-0 animate-[pulse-dot-anim_2s_ease-in-out_infinite] motion-reduce:animate-none" />
          <strong>{overdueCount} overdue checkout{overdueCount !== 1 ? "s" : ""}</strong>
        </div>
        <a href="/checkouts?filter=overdue" className="text-white/85 text-[var(--text-sm)] font-medium no-underline whitespace-nowrap shrink-0 hover:text-white hover:underline">Resolve all overdue &rarr;</a>
      </div>
      <div className="flex flex-col gap-1.5">
        {overdueItems.map((item) => (
          <div
            key={item.bookingId}
            className="flex items-center gap-2 bg-white/10 rounded-md px-3 py-2 cursor-pointer text-white w-full transition-colors hover:bg-white/[0.18] focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-[-2px]"
            role="button"
            tabIndex={0}
            onClick={() => onSelectBooking(item.bookingId)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectBooking(item.bookingId); } }}
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-[var(--text-sm)] font-semibold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item.bookingTitle}</span>
              <span className="flex items-center gap-1 text-xs opacity-75 [&_[data-slot=avatar-fallback]]:bg-white/20 [&_[data-slot=avatar-fallback]]:text-white">
                <UserAvatar name={item.requesterName} />
                {item.requesterName}
                {item.items.length > 0 && <> &middot; <GearAvatarStack items={item.items} totalCount={item.assetTags.length} /></>}
                {item.items.length === 0 && item.assetTags.length > 0 && <> &middot; {item.assetTags.join(", ")}</>}
                 &middot; <span className="text-[var(--text-3xs)] font-bold bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">{formatOverdueElapsed(item.endsAt, now)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8 text-white/70 hover:text-white hover:bg-white/10"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/scan?checkout=${item.bookingId}&phase=CHECKIN`} aria-label={`Check in ${item.bookingTitle}`}>
                      <ClipboardCheckIcon className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Check in</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8 text-white/70 hover:text-white hover:bg-white/10"
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
