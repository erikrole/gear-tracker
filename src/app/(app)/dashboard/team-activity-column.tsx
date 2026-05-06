"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AlertTriangleIcon, CalendarIcon, ClockIcon, InboxIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { formatDayLabel, formatTimeShort, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { ShiftAvatarStack } from "./dashboard-avatars";
import { DashboardBookingRow, dashboardBookingAccent } from "./booking-row";
import { DashboardSectionHeader } from "./section-header";
import type { DashboardData, BookingSummary } from "../dashboard-types";
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
};

export function TeamActivityColumn({ data, filtered, activeSport, now, isStaff, acting, onSelectBooking, onExtend }: Props) {
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

  function eventTitle(e: DashboardData["upcomingEvents"][number]) {
    if (e.opponent) {
      return `${e.sportCode ? `${sportLabel(e.sportCode)} ` : ""}${e.isHome === false ? "at" : "vs"} ${e.opponent}`;
    }
    return e.sportCode ? sportLabel(e.sportCode) : e.title;
  }

  function eventBorder(e: DashboardData["upcomingEvents"][number]) {
    if (e.isHome === true) return "border-l-[var(--green)]";
    if (e.isHome === false) return "border-l-[var(--orange)]";
    return "border-l-muted-foreground/30";
  }

  function eventCoverageBadge(e: DashboardData["upcomingEvents"][number]) {
    if (!e.coverage) return null;
    const variant = e.coverage.percentage >= 100 ? "green" : e.coverage.percentage > 0 ? "orange" : "red";
    return (
      <Badge variant={variant} size="sm">
        {e.coverage.filled}/{e.coverage.total}
      </Badge>
    );
  }

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
              <div
                key={e.id}
                className={cn(
                  "group flex items-start justify-between gap-3 w-full border-l-[3px] px-4 py-2.5 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40 no-underline text-inherit",
                  eventBorder(e),
                  e.coverage && e.coverage.filled < e.coverage.total && "bg-[var(--red-bg)]/10",
                )}
              >
                <Link href={`/events/${e.id}`} className="flex min-w-0 flex-1 flex-col gap-1 no-underline">
                  <span className="text-sm font-bold text-foreground truncate">{eventTitle(e)}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground leading-snug">
                    <span>
                      {formatDayLabel(e.startsAt, now)}{e.allDay ? " \u2013 All day" : `, ${formatTimeShort(e.startsAt)} \u2013 ${formatTimeShort(e.endsAt)}`}
                    </span>
                    {e.location && <span className="truncate">{e.location}</span>}
                    {e.callTime && <span>Call {formatTimeShort(e.callTime)}</span>}
                  </span>
                  {e.coverage && e.coverage.filled < e.coverage.total && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--red-text)]">
                      <AlertTriangleIcon className="size-3.5" />
                      {e.coverage.total - e.coverage.filled} open slot{e.coverage.total - e.coverage.filled === 1 ? "" : "s"}
                    </span>
                  )}
                </Link>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} filledSlots={e.filledShiftSlots} />
                  {eventCoverageBadge(e)}
                  {e.isHome === true && <Badge variant="green" size="sm">Home</Badge>}
                  {e.isHome === false && <Badge variant="orange" size="sm">Away</Badge>}
                  {e.isHome === null && e.opponent && <Badge variant="gray" size="sm">Neutral</Badge>}
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
