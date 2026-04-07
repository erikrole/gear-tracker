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
  inlineActionId: string | null;
  onSelectBooking: (id: string) => void;
  onExtend: (booking: BookingSummary, e: React.MouseEvent) => void;
  onCreateBooking?: (ctx: CreateBookingContext) => void;
};

export function TeamActivityColumn({ data, filtered, activeSport, now, isStaff, inlineActionId, onSelectBooking, onExtend, onCreateBooking }: Props) {
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");

  const filteredEvents = useMemo(() => {
    const events = filtered?.upcomingEvents ?? data.upcomingEvents;
    if (homeAwayFilter === "all") return events;
    return events.filter((e) =>
      homeAwayFilter === "home" ? e.isHome === true : e.isHome === false,
    );
  }, [filtered?.upcomingEvents, data.upcomingEvents, homeAwayFilter]);

  const cappedEvents = useMemo(() => filteredEvents.slice(0, 10), [filteredEvents]);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold text-muted-foreground pl-0.5">Team Activity</span>

      {/* Team Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="elevated">
        <a href="/bookings?tab=checkouts" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-[var(--radius)] hover:bg-[var(--panel-hover)] hover:no-underline">
          <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">Checked out</h2>
          <Badge variant="gray" size="sm">{data.teamCheckouts.total}</Badge>
        </a>
        {(filtered?.teamCheckouts ?? data.teamCheckouts.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-[var(--text-muted)] text-[var(--text-sm)]"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamCheckouts ?? data.teamCheckouts.items).map((c) => {
              const dueLabel = formatDueLabel(c.endsAt, now);
              return (
                <button
                  key={c.id}
                  className={`ops-row ops-row-status ${c.isOverdue ? "ops-row-overdue" : isDueToday(c.endsAt, now) ? "ops-row-due-today" : "ops-row-checked-out"}`}
                  onClick={() => onSelectBooking(c.id)}
                >
                  <div className="ops-row-main">
                    <span className="ops-row-title-bold">
                      {c.title}
                    </span>
                    <span className="ops-row-meta">
                      <UserAvatar name={c.requesterName} avatarUrl={c.requesterAvatarUrl} />
                      {c.requesterName} &ndash; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ops-row-right">
                    {isStaff && (c.isOverdue || isDueToday(c.endsAt, now)) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="inline-action-btn"
                            disabled={inlineActionId === c.id}
                            onClick={(e) => onExtend(c, e)}
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
        <a href="/bookings?tab=reservations" className="flex items-center justify-between px-4 py-3 border-b border-border/50 no-underline text-inherit cursor-pointer transition-colors rounded-t-[var(--radius)] hover:bg-[var(--panel-hover)] hover:no-underline">
          <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">Reserved</h2>
          <Badge variant="gray" size="sm">{data.teamReservations.total}</Badge>
        </a>
        {(filtered?.teamReservations ?? data.teamReservations.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-[var(--text-muted)] text-[var(--text-sm)]"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamReservations ?? data.teamReservations.items).map((r) => (
              <button
                key={r.id}
                className="ops-row ops-row-status ops-row-reserved"
                onClick={() => onSelectBooking(r.id)}
              >
                <div className="ops-row-main">
                  <span className="ops-row-title-bold">
                    {r.title}
                  </span>
                  <span className="ops-row-meta">
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
            <h2 className="text-[var(--text-sm)] font-semibold text-foreground m-0">Upcoming events</h2>
          </a>
          <ToggleGroup
            type="single"
            value={homeAwayFilter}
            onValueChange={(v) => v && setHomeAwayFilter(v as HomeAwayFilter)}
          >
            <ToggleGroupItem value="all" className="text-xs px-2 py-1">All</ToggleGroupItem>
            <ToggleGroupItem value="home" className="text-xs px-2 py-1">Home</ToggleGroupItem>
            <ToggleGroupItem value="away" className="text-xs px-2 py-1">Away</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {cappedEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-[var(--text-muted)] text-[var(--text-sm)]">
            <CalendarIcon className="size-6 opacity-40" />
            {homeAwayFilter !== "all"
              ? `No ${homeAwayFilter} events this week`
              : activeSport ? `No ${activeSport} events` : "No upcoming events"}
          </div>
        ) : (
          <CardContent className="p-0 py-1">
            {cappedEvents.map((e) => (
              <div key={e.id} className="ops-row no-underline text-inherit">
                <a href={`/events/${e.id}`} className="ops-row-main no-underline">
                  <span className="ops-row-title-bold">
                    {e.sportCode && <span className="text-xs font-bold mr-1">{sportLabel(e.sportCode)}</span>}
                    {e.opponent ? <span className="text-muted-foreground font-normal">vs {e.opponent}</span> : (!e.sportCode ? e.title : "")}
                  </span>
                  <span className="ops-row-meta">
                    {formatDayLabel(e.startsAt, now)}{e.allDay ? " \u2013 All day" : `, ${formatTimeShort(e.startsAt)} \u2013 ${formatTimeShort(e.endsAt)}`}
                    {e.location && ` \u00B7 ${e.location}`}
                  </span>
                </a>
                <div className="event-row-right">
                  <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} />
                  {e.isHome !== null && (
                    <Badge variant={e.isHome ? "green" : "red"}>
                      {e.isHome ? "Home" : "Away"}
                    </Badge>
                  )}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7 transition-opacity">
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
