"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CalendarIcon, ClockIcon, InboxIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { formatDayLabel, formatTimeShort, isDueToday } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";
import {
  VENUE_FILTER_OPTIONS,
  VENUE_TONES,
  venueBadgeVariant,
  venueFilterActiveClass,
  venueToneFromIsHome,
  type VenueFilter,
} from "@/lib/venue-tone";
import { ShiftAvatarStack } from "./dashboard-avatars";
import { DashboardBookingRow, dashboardBookingAccent } from "./booking-row";
import { DashboardSectionHeader } from "./section-header";
import type { DashboardData, BookingSummary } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type HomeAwayFilter = VenueFilter;

const PENDING_PICKUPS_HREF = "/bookings?tab=checkouts&status=PENDING_PICKUP";
const STALE_RESERVATIONS_HREF = "/bookings?tab=reservations&filter=overdue";

type Props = {
  data: DashboardData;
  filtered: FilteredDashboardData | null;
  activeSport: string | null;
  hasActiveFilter: boolean;
  now: Date;
  isStaff: boolean;
  acting: boolean;
  onSelectBooking: (id: string) => void;
  onExtend: (booking: BookingSummary, e: React.MouseEvent) => void;
};

export function TeamActivityColumn({ data, filtered, activeSport, hasActiveFilter, now, isStaff, acting, onSelectBooking, onExtend }: Props) {
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");
  const visibleTeamCheckouts = filtered?.teamCheckouts ?? data.teamCheckouts.items;
  const visiblePendingPickups = filtered?.pendingPickups ?? data.pendingPickups.items;
  const visibleStaleReservations = filtered?.staleReservations ?? data.staleReservations.items;
  const visibleTeamReservations = filtered?.teamReservations ?? data.teamReservations.items;
  const teamCheckoutsCount = filtered ? visibleTeamCheckouts.length : data.teamCheckouts.total;
  const pendingPickupsCount = filtered ? visiblePendingPickups.length : data.pendingPickups.total;
  const staleReservationsCount = filtered ? visibleStaleReservations.length : data.staleReservations.total;
  const teamReservationsCount = filtered ? visibleTeamReservations.length : data.teamReservations.total;

  const filteredEvents = useMemo(() => {
    const events = filtered?.upcomingEvents ?? data.upcomingEvents;
    if (homeAwayFilter === "all") return events;
    return events.filter((e) => {
      if (homeAwayFilter === "home") return e.isHome === true;
      if (homeAwayFilter === "away") return e.isHome === false;
      if (homeAwayFilter === "neutral") return e.isHome === null;
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
    return VENUE_TONES[venueToneFromIsHome(e.isHome)].railClass;
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
        <DashboardSectionHeader title="Checked out" href="/bookings?tab=checkouts" count={teamCheckoutsCount} />
        {visibleTeamCheckouts.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {visibleTeamCheckouts.map((c) => {
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
                            className="opacity-100 transition-opacity duration-150 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
            {!hasActiveFilter && data.teamCheckouts.total > data.teamCheckouts.items.length && (
              <Link href="/bookings?tab=checkouts" className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.teamCheckouts.total} &rarr;</Link>
            )}
          </CardContent>
        )}
      </Card>
      </ScaleIn>

      {/* Awaiting Pickup - only render when present (transient state) */}
      {visiblePendingPickups.length > 0 && (
        <ScaleIn delay={0.025}>
        <Card>
          <DashboardSectionHeader title="Awaiting pickup" href={PENDING_PICKUPS_HREF} count={pendingPickupsCount} />
          <CardContent className="p-0 py-1">
            {visiblePendingPickups.map((p) => {
              const isLate = new Date(p.startsAt).getTime() < now.getTime();
              return (
                <DashboardBookingRow
                  key={p.id}
                  booking={p}
                  now={now}
                  accent={isLate ? "pending-pickup-late" : "pending-pickup"}
                  showPickupBadge
                  onSelectBooking={onSelectBooking}
                />
              );
            })}
            {!hasActiveFilter && data.pendingPickups.total > data.pendingPickups.items.length && (
              <Link href={PENDING_PICKUPS_HREF} className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.pendingPickups.total} &rarr;</Link>
            )}
          </CardContent>
        </Card>
        </ScaleIn>
      )}

      {/* Stale Reservations - planning cleanup separate from checked-out overdue custody */}
      {visibleStaleReservations.length > 0 && (
        <ScaleIn delay={0.04}>
        <Card>
          <DashboardSectionHeader title="Stale reservations" href={STALE_RESERVATIONS_HREF} count={staleReservationsCount} />
          <CardContent className="p-0 py-1">
            {visibleStaleReservations.map((r) => (
              <DashboardBookingRow
                key={r.id}
                booking={r}
                now={now}
                accent="overdue"
                showDueBadge
                onSelectBooking={onSelectBooking}
              />
            ))}
            {!hasActiveFilter && data.staleReservations.total > data.staleReservations.items.length && (
              <Link href={STALE_RESERVATIONS_HREF} className="block text-center text-xs text-muted-foreground py-2 px-4 border-t border-border/50 no-underline transition-colors hover:text-foreground">View all {data.staleReservations.total} &rarr;</Link>
            )}
          </CardContent>
        </Card>
        </ScaleIn>
      )}

      {/* Team Reservations */}
      <ScaleIn delay={0.05}>
      <Card>
        <DashboardSectionHeader title="Reserved" href="/bookings?tab=reservations" count={teamReservationsCount} />
        {visibleTeamReservations.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground text-sm"><InboxIcon className="size-6 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {visibleTeamReservations.map((r) => (
              <DashboardBookingRow
                key={r.id}
                booking={r}
                now={now}
                accent="reservation"
                onSelectBooking={onSelectBooking}
              />
            ))}
            {!hasActiveFilter && data.teamReservations.total > data.teamReservations.items.length && (
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
              aria-label="Venue filter"
            >
              {VENUE_FILTER_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "text-xs px-2 py-1 data-[state=on]:shadow-sm",
                    homeAwayFilter === option.value && venueFilterActiveClass(option.value),
                  )}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
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
                </Link>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <ShiftAvatarStack assignedUsers={e.assignedUsers} />
                  {eventCoverageBadge(e)}
                  {e.opponent && (
                    <Badge variant={venueBadgeVariant(e.isHome)} size="sm">
                      {VENUE_TONES[venueToneFromIsHome(e.isHome)].label}
                    </Badge>
                  )}
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
