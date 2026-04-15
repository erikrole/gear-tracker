"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CalendarCheckIcon, CalendarIcon, ClipboardCheckIcon, ClockIcon, InboxIcon, PackageIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { formatDueLabel, formatEventDateTime, formatTimeShort, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { UserAvatar, GearAvatarStack, ShiftAvatarStack } from "./dashboard-avatars";
import type { DashboardData, BookingSummary, CreateBookingContext } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type HomeAwayFilter = "all" | "home" | "away";

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
  isStaff: boolean;
  acting: boolean;
  onSelectBooking: (id: string) => void;
  onExtend: (booking: BookingSummary, e: React.MouseEvent) => void;
  onCreateBooking?: (ctx: CreateBookingContext) => void;
};

export function TeamActivityColumn({ data, filtered, activeSport, now, isStaff, acting, onSelectBooking, onExtend, onCreateBooking }: Props) {
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");

  const filteredEvents = useMemo(() => {
    const events = filtered?.upcomingEvents ?? data.upcomingEvents;
    if (homeAwayFilter === "all") return events;
    return events.filter((e) => {
      if (homeAwayFilter === "home") return e.isHome === true;
      if (homeAwayFilter === "away") return e.isHome === false;
      if (homeAwayFilter === "neutral") return e.isHome === null && e.opponent;
      return true;
    });
  }, [filtered?.upcomingEvents, data.upcomingEvents, homeAwayFilter]);

  const cappedEvents = useMemo(() => filteredEvents.slice(0, 10), [filteredEvents]);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-muted-foreground pl-0.5">Team Activity</span>

      {/* Team Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="elevated">
        <a href="/bookings?tab=checkouts" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-lg hover:bg-muted/60 hover:no-underline">
          <h2 className="text-sm font-semibold text-foreground m-0">Checked out</h2>
          <Badge variant="gray" size="sm">{data.teamCheckouts.total}</Badge>
        </a>
        {(filtered?.teamCheckouts ?? data.teamCheckouts.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamCheckouts ?? data.teamCheckouts.items).map((c) => {
              const dueLabel = formatDueLabel(c.endsAt, now);
              return (
                <button
                  key={c.id}
                  className={cn(
                    "group flex items-center justify-between gap-3 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-left transition-colors [&+&]:border-t [&+&]:border-border/40 border-l-[3px] pl-[13px]",
                    c.isOverdue
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
                    {isStaff && (c.isOverdue || isDueToday(c.endsAt, now)) && (
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
            {!activeSport && data.teamCheckouts.total > data.teamCheckouts.items.length && (
              <a href="/bookings?tab=checkouts" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.teamCheckouts.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* Team Reservations */}
      <ScaleIn delay={0.05}>
      <Card>
        <a href="/bookings?tab=reservations" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-lg hover:bg-muted/60 hover:no-underline">
          <h2 className="text-sm font-semibold text-foreground m-0">Reserved</h2>
          <Badge variant="gray" size="sm">{data.teamReservations.total}</Badge>
        </a>
        {(filtered?.teamReservations ?? data.teamReservations.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamReservations ?? data.teamReservations.items).map((r) => (
              <button
                key={r.id}
                className="group flex items-center justify-between gap-3 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-left transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40 border-l-[3px] pl-[13px] border-l-purple-600"
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
                <GearAvatarStack items={r.items} totalCount={r.itemCount} />
              </button>
            ))}
            {!activeSport && data.teamReservations.total > data.teamReservations.items.length && (
              <a href="/bookings?tab=reservations" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.teamReservations.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* Upcoming Events */}
      <ScaleIn delay={0.1}>
      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <a href="/schedule" className="no-underline text-inherit hover:no-underline">
            <h2 className="text-sm font-semibold text-foreground m-0">Upcoming events</h2>
          </a>
          <ToggleGroup
            type="single"
            value={homeAwayFilter}
            onValueChange={(v) => v && setHomeAwayFilter(v as HomeAwayFilter)}
            aria-label="Home or away filter"
          >
            <ToggleGroupItem value="all" className="text-xs px-2 py-1">All</ToggleGroupItem>
            <ToggleGroupItem value="home" className="text-xs px-2 py-1">Home</ToggleGroupItem>
            <ToggleGroupItem value="away" className="text-xs px-2 py-1">Away</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {cappedEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm">
            <CalendarIcon className="size-6 opacity-40" />
            {homeAwayFilter !== "all"
              ? `No upcoming ${homeAwayFilter} events`
              : activeSport ? `No upcoming ${activeSport} events` : "No upcoming events"}
          </div>
        ) : (
          <CardContent className="p-0 py-1">
            {cappedEvents.map((e) => (
              <div key={e.id} className="group flex items-center justify-between gap-3 w-full px-4 py-2 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40 no-underline text-inherit">
                <a href={`/events/${e.id}`} className="flex flex-col gap-0.5 min-w-0 no-underline">
                  <span className="text-sm font-bold text-foreground truncate tracking-tight">
                    {e.sportCode && <span className="text-xs font-bold mr-1">{sportLabel(e.sportCode)}</span>}
                    {e.opponent ? <span className="text-muted-foreground font-normal">vs {e.opponent}</span> : (!e.sportCode ? e.title : "")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                    {formatDayLabel(e.startsAt, now)}{e.allDay ? " \u2013 All day" : `, ${formatTimeShort(e.startsAt)} \u2013 ${formatTimeShort(e.endsAt)}`}
                    {e.location && ` \u00B7 ${e.location}`}
                  </span>
                </a>
                <div className="flex items-center gap-2 shrink-0">
                  <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} filledSlots={e.filledShiftSlots} />
                  {e.isHome === true && <Badge variant="green">Home</Badge>}
                  {e.isHome === false && <Badge variant="red">Away</Badge>}
                  {e.isHome === null && e.opponent && <Badge variant="blue">Neutral</Badge>}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 transition-opacity" aria-label="Create booking for this event">
                            <PackageIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Create booking for this event</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onCreateBooking?.({
                        kind: "CHECKOUT",
                        title: e.title,
                        startsAt: e.startsAt,
                        endsAt: e.endsAt,
                        locationId: e.locationId || undefined,
                        eventId: e.id,
                        sportCode: e.sportCode || undefined,
                      })}>
                        <ClipboardCheckIcon className="mr-2 size-4" />
                        New checkout
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCreateBooking?.({
                        kind: "RESERVATION",
                        title: e.title,
                        startsAt: e.startsAt,
                        endsAt: e.endsAt,
                        locationId: e.locationId || undefined,
                        eventId: e.id,
                        sportCode: e.sportCode || undefined,
                      })}>
                        <CalendarCheckIcon className="mr-2 size-4" />
                        New reservation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {filteredEvents.length > 10 && (
              <a href="/schedule" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">Show all {filteredEvents.length} events &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>
    </div>
  );
}
