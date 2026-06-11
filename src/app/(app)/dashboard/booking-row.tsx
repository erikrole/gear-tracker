"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { ArrowUpRightIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { formatDueLabel, formatEventDateTime, formatPickupLabel, isDueToday } from "@/lib/format";
import { GearAvatarStack } from "./dashboard-avatars";
import type { ItemThumb } from "../dashboard-types";

type DashboardBookingRowItem = {
  id: string;
  title: string;
  requesterName: string;
  requesterAvatarUrl: string | null;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  isOverdue?: boolean;
  items: ItemThumb[];
};

type Accent = "owned" | "checkout" | "reservation" | "due" | "overdue" | "pending-pickup" | "pending-pickup-late";

type Props = {
  booking: DashboardBookingRowItem;
  now: Date;
  accent: Accent;
  showDueBadge?: boolean;
  /** When set, renders a pickup badge using booking.startsAt instead of the due badge. */
  showPickupBadge?: boolean;
  actions?: ReactNode;
  onSelectBooking: (id: string) => void;
};

const accentClasses: Record<Accent, string> = {
  owned: "border-l-primary hover:bg-muted/50",
  checkout: "border-l-[var(--blue)] hover:bg-muted/50",
  reservation: "border-l-[var(--purple)] hover:bg-muted/50",
  due: "border-l-[var(--orange)] bg-[var(--orange)]/[0.04] dark:bg-[var(--orange)]/[0.12] hover:bg-[var(--orange)]/[0.08] dark:hover:bg-[var(--orange)]/[0.18]",
  overdue: "border-l-[var(--wi-red)] bg-[var(--wi-red)]/[0.06] dark:bg-[var(--wi-red)]/[0.18] hover:bg-[var(--wi-red)]/10 dark:hover:bg-[var(--wi-red)]/25",
  "pending-pickup":
    "border-l-[var(--orange)] bg-[var(--orange)]/[0.03] dark:bg-[var(--orange)]/[0.10] hover:bg-[var(--orange)]/[0.07] dark:hover:bg-[var(--orange)]/[0.16]",
  "pending-pickup-late": "border-l-[var(--orange)] bg-[var(--orange)]/[0.04] dark:bg-[var(--orange)]/[0.12] hover:bg-[var(--orange)]/[0.08] dark:hover:bg-[var(--orange)]/[0.18]",
};

export function dashboardBookingAccent(
  booking: { isOverdue?: boolean; endsAt: string },
  now: Date,
  fallback: Accent,
): Accent {
  if (booking.isOverdue) return "overdue";
  if (isDueToday(booking.endsAt, now)) return "due";
  return fallback;
}

export function DashboardBookingRow({
  booking,
  now,
  accent,
  showDueBadge = false,
  showPickupBadge = false,
  actions,
  onSelectBooking,
}: Props) {
  const dueLabel = formatDueLabel(booking.endsAt, now);
  const dueVariant = booking.isOverdue
    ? "red"
    : isDueToday(booking.endsAt, now)
    ? "orange"
    : "gray";
  const pickupIsLate = showPickupBadge && new Date(booking.startsAt).getTime() < now.getTime();
  const pickupLabel = showPickupBadge ? formatPickupLabel(booking.startsAt, now) : "";
  const pickupVariant = pickupIsLate ? "orange" : "gray";

  return (
    <Item
      size="sm"
      className={cn(
        "group min-h-14 rounded-none py-2.5 border-l-[3px] pl-[13px] [&+[data-slot=item]]:border-t [&+[data-slot=item]]:border-border/40",
        accentClasses[accent],
      )}
    >
      <ItemContent>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => onSelectBooking(booking.id)}
          aria-label={`Open ${booking.title}`}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ItemTitle className="truncate font-bold text-foreground">
              {booking.title}
            </ItemTitle>
            <ItemDescription className="flex min-w-0 items-center gap-1 text-xs leading-snug line-clamp-none">
              <UserAvatar name={booking.requesterName} avatarUrl={booking.requesterAvatarUrl} />
              <span className="truncate">{booking.requesterName}</span>
              <span aria-hidden="true">/</span>
              <span className="shrink-0">
                {booking.itemCount} item{booking.itemCount !== 1 ? "s" : ""}
              </span>
            </ItemDescription>
          </div>
          <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground/35 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden="true" />
        </button>
      </ItemContent>

      <ItemActions className="shrink-0 gap-1.5 sm:gap-2.5">
        {actions}
        {showDueBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={dueVariant} size="sm" className="cursor-default tabular-nums">
                {dueLabel}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{formatEventDateTime(booking.startsAt, booking.endsAt)}</TooltipContent>
          </Tooltip>
        )}
        {showPickupBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={pickupVariant} size="sm" className="cursor-default tabular-nums">
                {pickupIsLate ? pickupLabel : `Pickup ${pickupLabel}`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{formatEventDateTime(booking.startsAt, booking.endsAt)}</TooltipContent>
          </Tooltip>
        )}
        <div className="hidden sm:block">
          <GearAvatarStack items={booking.items} totalCount={booking.itemCount} />
        </div>
      </ItemActions>
    </Item>
  );
}
