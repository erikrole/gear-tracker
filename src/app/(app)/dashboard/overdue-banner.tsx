"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, ArrowRightIcon, BellRingIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatOverdueElapsed } from "@/lib/format";
import { UserAvatar } from "@/components/UserAvatar";
import { GearAvatarStack } from "./dashboard-avatars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card
      elevation="flat"
      className="relative mb-4 overflow-hidden border-[var(--wi-red)]/20 animate-[dash-fade-up_0.4s_ease_both] motion-reduce:animate-none"
    >
      <div className="absolute inset-y-0 left-0 w-[3px] bg-[var(--wi-red)]" aria-hidden="true" />

      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/50 py-3 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--red-bg)] text-[var(--red-text)]">
            <AlertTriangleIcon className="size-4" aria-hidden="true" />
          </span>
          <CardTitle className="truncate text-sm">Overdue checkouts</CardTitle>
          <Badge variant="red" size="sm" className="tabular-nums">
            {overdueCount}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" asChild>
          <Link href="/checkouts?filter=overdue">
            View all
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {overdueItems.map((item) => (
          <div
            key={item.bookingId}
            className="group flex min-h-16 w-full items-center gap-2.5 border-b border-border/40 px-4 py-2.5 pl-[15px] text-inherit transition-colors last:border-b-0 hover:bg-muted/45"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col gap-1 rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={() => onSelectBooking(item.bookingId)}
              aria-label={`Open overdue checkout ${item.bookingTitle}`}
            >
              <span className="truncate text-sm font-bold text-foreground">
                {item.bookingTitle}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs leading-snug text-muted-foreground">
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
                <Badge variant="red" size="sm" className="tabular-nums">
                  {formatOverdueElapsed(item.endsAt, now)}
                </Badge>
              </span>
            </button>
            {canAction && (
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
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
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
