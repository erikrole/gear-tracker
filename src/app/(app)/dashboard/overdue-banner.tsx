"use client";

import { useRef, useState } from "react";
import { BellRingIcon, CheckIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { handleAuthRedirect, parseErrorMessage } from "@/lib/errors";
import type { OverdueItem } from "../dashboard-types";
import { DashboardBookingRow } from "./booking-row";
import { DashboardSectionHeader } from "./section-header";

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
    <Card
      elevation="flat"
      className="mb-4 overflow-hidden border-[var(--wi-red)]/20 animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none"
    >
      <DashboardSectionHeader
        title="Overdue checkouts"
        href="/checkouts?filter=overdue"
        count={overdueCount}
        countVariant="red"
      />

      <CardContent className="p-0">
        {overdueItems.map((item) => {
          const nudgeAction = canAction ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:bg-[var(--red-bg)] hover:text-[var(--red-text)]"
                  disabled={nudgedIds.has(item.bookingId) || nudgingId === item.bookingId}
                  onClick={() => handleNudge(item.bookingId)}
                  aria-label={`Nudge ${item.requesterName}`}
                >
                  {nudgingId === item.bookingId ? (
                    <Spinner />
                  ) : nudgedIds.has(item.bookingId) ? (
                    <CheckIcon className="size-4 text-[var(--green-text)]" />
                  ) : (
                    <BellRingIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {nudgedIds.has(item.bookingId) ? "Nudge sent" : `Nudge ${item.requesterName}`}
              </TooltipContent>
            </Tooltip>
          ) : undefined;

          return (
            <DashboardBookingRow
              key={item.bookingId}
              booking={{
                id: item.bookingId,
                title: item.bookingTitle,
                requesterName: item.requesterName,
                requesterAvatarUrl: item.requesterAvatarUrl,
                startsAt: item.startsAt,
                endsAt: item.endsAt,
                itemCount: item.itemCount,
                isOverdue: true,
                items: item.items,
              }}
              now={now}
              accent="overdue"
              showDueBadge
              actions={nudgeAction}
              onSelectBooking={onSelectBooking}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
