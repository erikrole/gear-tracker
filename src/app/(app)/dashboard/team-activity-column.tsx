"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import { formatDayLabel, formatTimeShort, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { ShiftAvatarStack } from "./dashboard-avatars";
import { DashboardBookingRow, dashboardBookingAccent } from "./booking-row";
import { DashboardSectionHeader } from "./section-header";
import type { DashboardData, BookingSummary, CreateBookingContext } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type HomeAwayFilter = "all" | "home" | "away";

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
      return true;
    });
  }, [filtered?.upcomingEvents, data.upcomingEvents, homeAwayFilter]);

  const cappedEvents = useMemo(() => filteredEvents.slice(0, 10), [filteredEvents]);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 pl-0.5" style={{ fontFamily: "var(--font-mono)" }}>Team Activity</span>

      {/* Team Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="elevated">
        <DashboardSectionHeader title="Checked out" href="/bookings?tab=checkouts" count={data.teamCheckouts.total} />
        {(filtered?.teamCheckouts ?? data.teamCheckouts.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamCheckouts ?? data.teamCheckouts.items).map((c) => {
              return (
                <DashboardBookingRow
                  key={c.id}
                  booking={c}
                  now={now}
                  accent={dashboardBookingAccent(c, now, "checkout")}
                  showDueBadge
                  onSelectBooking={onSelectBooking}
                  actions={
                    isStaff && (c.isOverdue || isDueToday(c.endsAt, now)) ? (
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
                    ) : null
                  }
                />
              );
            })}
            {!activeSport && data.teamCheckouts.total > data.teamCheckouts.items.length && (
              <Link href="/bookings?tab=checkouts" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.teamCheckouts.total} &rarr;</Link>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* Team Reservations */}
      <ScaleIn delay={0.05}>
      <Card>
        <DashboardSectionHeader title="Reserved" href="/bookings?tab=reservations" count={data.teamReservations.total} />
        {(filtered?.teamReservations ?? data.teamReservations.items).length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.teamReservations ?? data.teamReservations.items).map((r) => (
              <DashboardBookingRow
                key={r.id}
                booking={r}
                now={now}
                accent="reservation"
                onSelectBooking={onSelectBooking}
              />
            ))}
            {!activeSport && data.teamReservations.total > data.teamReservations.items.length && (
              <Link href="/bookings?tab=reservations" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.teamReservations.total} &rarr;</Link>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* Upcoming Events */}
      <ScaleIn delay={0.1}>
      <Card>
        <DashboardSectionHeader
          title="Upcoming events"
          href="/schedule"
          className="grid-cols-1 gap-y-2"
          actionClassName="col-start-1 row-start-2 justify-self-start"
          action={
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
          }
        />
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
                <Link href={`/events/${e.id}`} className="flex flex-col gap-0.5 min-w-0 no-underline">
                  <span className="text-sm font-bold text-foreground truncate">
                    {e.opponent
                      ? `${e.sportCode ? `${sportLabel(e.sportCode)} ` : ""}${e.isHome === false ? "at" : "vs"} ${e.opponent}`
                      : e.sportCode ? sportLabel(e.sportCode) : e.title}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground leading-snug">
                    {formatDayLabel(e.startsAt, now)}{e.allDay ? " \u2013 All day" : `, ${formatTimeShort(e.startsAt)} \u2013 ${formatTimeShort(e.endsAt)}`}
                    {e.location && ` \u00B7 ${e.location}`}
                  </span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} filledSlots={e.filledShiftSlots} />
                  {e.isHome === true && <Badge variant="green">Home</Badge>}
                  {e.isHome === false && <Badge variant="orange">Away</Badge>}
                  {e.isHome === null && e.opponent && <Badge variant="gray">Neutral</Badge>}
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
              <Link href="/schedule" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">Show all {filteredEvents.length} events &rarr;</Link>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>
    </div>
  );
}
