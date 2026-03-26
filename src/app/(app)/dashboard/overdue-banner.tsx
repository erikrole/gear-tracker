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
    <div className="overdue-banner">
      <div className="overdue-banner-header">
        <div className="overdue-banner-title">
          <AlertTriangleIcon className="overdue-banner-icon size-[18px]" />
          <span className="pulse-dot" />
          <strong>{overdueCount} overdue checkout{overdueCount !== 1 ? "s" : ""}</strong>
        </div>
        <a href="/checkouts?filter=overdue" className="overdue-banner-viewall">Resolve all overdue &rarr;</a>
      </div>
      <div className="overdue-banner-list">
        {overdueItems.map((item) => (
          <button
            key={item.bookingId}
            className="overdue-banner-item"
            onClick={() => onSelectBooking(item.bookingId)}
          >
            <div className="overdue-banner-item-main">
              <span className="overdue-banner-item-title">{item.bookingTitle}</span>
              <span className="overdue-banner-item-meta">
                <UserAvatar name={item.requesterName} />
                {item.requesterName}
                {item.items.length > 0 && <> &middot; <GearAvatarStack items={item.items} totalCount={item.assetTags.length} /></>}
                {item.items.length === 0 && item.assetTags.length > 0 && <> &middot; {item.assetTags.join(", ")}</>}
                 &middot; <span className="overdue-elapsed">{formatOverdueElapsed(item.endsAt, now)}</span>
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
