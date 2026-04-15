"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardCheckIcon, CalendarCheckIcon, ClockIcon, ArrowRightCircleIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { formatDueLabel, formatEventDateTime, formatRelativeTime, formatTimeShort, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { UserAvatar, GearAvatarStack } from "./dashboard-avatars";
import type { DashboardData, BookingSummary, CreateBookingContext } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

/** "Today", "Tomorrow", or "Wednesday, Apr 9" */
function formatDayLabel(dateStr: string, now: Date): string {
  const date = new Date(dateStr);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrowStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  if (date >= todayStart && date < tomorrowStart) return "Today";
  if (date >= tomorrowStart && date < dayAfterTomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

type Props = {
  data: DashboardData;
  filtered: FilteredDashboardData | null;
  activeSport: string | null;
  now: Date;
  acting: boolean;
  ownedAccent?: boolean;
  onSelectBooking: (id: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onExtend: (booking: BookingSummary, e: React.MouseEvent) => void;
  onConvert: (bookingId: string, e: React.MouseEvent) => void;
  onCreateBooking?: (ctx: CreateBookingContext) => void;
};

export function MyGearColumn({
  data,
  filtered,
  activeSport,
  now,
  acting,
  ownedAccent,
  onSelectBooking,
  onDeleteDraft,
  onExtend,
  onConvert,
  onCreateBooking,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-muted-foreground pl-0.5">My Gear</span>

      {/* My Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="elevated">
        <a href="/checkouts?mine=true" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-lg hover:bg-muted/60 hover:no-underline">
          <h2 className="text-sm font-semibold text-foreground m-0">My checkouts</h2>
          <Badge variant="gray" size="sm">{data.myCheckouts.total}</Badge>
        </a>
        {(filtered?.myCheckouts ?? data.myCheckouts.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><ClipboardCheckIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "You have no gear checked out"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.myCheckouts ?? data.myCheckouts.items).map((c) => {
              const dueLabel = formatDueLabel(c.endsAt, now);
              return (
                <button
                  key={c.id}
                  className={cn(
                    "group flex items-center justify-between gap-3 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-left transition-colors [&+&]:border-t [&+&]:border-border/40 border-l-[3px] pl-[13px]",
                    ownedAccent
                      ? "border-l-primary hover:bg-muted/50"
                      : c.isOverdue
                      ? "border-l-red-600 bg-red-600/[0.06] hover:bg-red-600/10"
                      : isDueToday(c.endsAt, now)
                      ? "border-l-amber-600 bg-amber-600/[0.04] hover:bg-amber-600/[0.08]"
                      : "border-l-blue-500 hover:bg-muted/50"
                  )}
                  onClick={() => onSelectBooking(c.id)}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-bold text-foreground truncate tracking-tight">
                      {c.title}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                      <UserAvatar name={c.requesterName} avatarUrl={c.requesterAvatarUrl} />
                      {c.requesterName} &ndash; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {(c.isOverdue || isDueToday(c.endsAt, now)) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                            disabled={acting}
                            onClick={(e) => onExtend(c, e)}
                            aria-label={`Extend checkout "${c.title}" by 1 day`}
                          >
                            <ClockIcon className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Extend 1 day</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={c.isOverdue ? "red" : isDueToday(c.endsAt, now) ? "orange" : "gray"} size="sm" className="cursor-default">{dueLabel}</Badge>
                      </TooltipTrigger>
                      <TooltipContent>{formatEventDateTime(c.startsAt, c.endsAt)}</TooltipContent>
                    </Tooltip>
                    <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                  </div>
                </button>
              );
            })}
            {!activeSport && data.myCheckouts.total > data.myCheckouts.items.length && (
              <a href="/checkouts?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.myCheckouts.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* My Reservations */}
      <ScaleIn delay={0.05}>
      <Card>
        <a href="/reservations?mine=true" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-lg hover:bg-muted/60 hover:no-underline">
          <h2 className="text-sm font-semibold text-foreground m-0">My reservations</h2>
          <Badge variant="gray" size="sm">{data.myReservations.length}</Badge>
        </a>
        {(filtered?.myReservations ?? data.myReservations).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><CalendarCheckIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No reservations coming up"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.myReservations ?? data.myReservations).map((r) => (
              <button
                key={r.id}
                className={cn(
                  "group flex items-center justify-between gap-3 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-left transition-colors [&+&]:border-t [&+&]:border-border/40 border-l-[3px] pl-[13px]",
                  ownedAccent ? "border-l-primary hover:bg-muted/50" : "border-l-purple-600 hover:bg-muted/50"
                )}
                onClick={() => onSelectBooking(r.id)}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-bold text-foreground truncate tracking-tight">
                    {r.title}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                    <UserAvatar name={r.requesterName} avatarUrl={r.requesterAvatarUrl} />
                    {r.requesterName} &ndash; {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                        disabled={acting}
                        onClick={(e) => onConvert(r.id, e)}
                        aria-label={`Convert reservation "${r.title}" to checkout`}
                      >
                        <ArrowRightCircleIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Convert to checkout</TooltipContent>
                  </Tooltip>
                  <GearAvatarStack items={r.items} totalCount={r.itemCount} />
                </div>
              </button>
            ))}
            {!activeSport && data.myReservations.length >= 5 && (
              <a href="/reservations?mine=true" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* My Shifts */}
      {(filtered?.myShifts ?? data.myShifts).length > 0 && (
        <ScaleIn delay={0.1}>
        <Card>
          <a href="/schedule" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-lg hover:bg-muted/60 hover:no-underline">
            <h2 className="text-sm font-semibold text-foreground m-0">My shifts</h2>
            <Badge variant="gray" size="sm">{data.myShifts.length}</Badge>
          </a>
          <CardContent className="p-0 py-1">
            {(filtered?.myShifts ?? data.myShifts).map((s) => {
              const gearLabel = s.gearStatus === "checked_out" ? "Gear out" : s.gearStatus === "reserved" ? "Reserved" : s.gearStatus === "draft" ? "Draft" : null;
              const eventTitle = s.event.opponent
                ? `${s.event.isHome === false ? "at" : "vs"} ${s.event.opponent}`
                : s.event.summary;
              return (
                <div key={s.id} className="group flex items-center justify-between gap-3 w-full px-4 py-2 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-bold text-foreground truncate tracking-tight">
                      {s.event.sportCode && <span className="text-xs font-bold mr-1">{sportLabel(s.event.sportCode)}</span>}
                      <span className="text-muted-foreground font-normal">{eventTitle}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                      {formatDayLabel(s.startsAt, now)}, {formatTimeShort(s.startsAt)} – {formatTimeShort(s.event.endsAt)}
                      {s.event.locationName && ` \u00B7 ${s.event.locationName}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {gearLabel ? (
                      <>
                        <GearAvatarStack items={s.gearItems} totalCount={s.gearItemCount} />
                        <Badge variant={s.gearStatus === "checked_out" ? "green" : s.gearStatus === "reserved" ? "orange" : "gray"}>
                          {gearLabel}
                        </Badge>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCreateBooking?.({
                          kind: "CHECKOUT",
                          title: eventTitle,
                          startsAt: s.event.startsAt,
                          endsAt: s.event.endsAt,
                          locationId: s.event.locationId || undefined,
                          eventId: s.event.id,
                          sportCode: s.event.sportCode || undefined,
                        })}
                      >
                        Prep gear
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        </ScaleIn>
      )}

      {/* Drafts */}
      {data.drafts.length > 0 && (
        <ScaleIn delay={0.15}>
        <Card elevation="elevated">
          <CardHeader className="border-b border-border/50">
            <CardTitle>Drafts</CardTitle>
            <Badge variant="gray" size="sm">{data.drafts.length}</Badge>
          </CardHeader>
          <CardContent className="p-0 py-1">
            {data.drafts.map((d) => (
              <div key={d.id} className="group flex items-center justify-between gap-3 w-full px-4 py-2 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate tracking-tight">
                    <Badge variant="outline" size="sm" className="mr-1.5">{d.kind === "CHECKOUT" ? "Checkout" : "Reservation"}</Badge>
                    {d.title || "Untitled"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                    {d.itemCount > 0 && <>{d.itemCount} item{d.itemCount !== 1 ? "s" : ""} &middot; </>}
                    Edited {formatRelativeTime(d.updatedAt, now)}
                  </span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/${d.kind === "CHECKOUT" ? "checkouts" : "reservations"}?draftId=${d.id}`}>
                      Resume
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={acting}
                    onClick={() => onDeleteDraft(d.id)}
                  >
                    Delete draft
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </ScaleIn>
      )}
    </div>
  );
}
