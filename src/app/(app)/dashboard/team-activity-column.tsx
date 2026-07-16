"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarDaysIcon, CalendarIcon, InboxIcon } from "lucide-react";
import { ScaleIn } from "@/components/ui/motion";
import { formatDayLabel, formatTimeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  VENUE_FILTER_OPTIONS,
  VENUE_TONES,
  venueBadgeVariant,
  venueFilterActiveClass,
  venueToneFromEvent,
  venueToneFromIsHome,
  type VenueFilter,
} from "@/lib/venue-tone";
import { ShiftAvatarStack } from "./dashboard-avatars";
import { DashboardBookingRow, dashboardBookingAccent } from "./booking-row";
import { dashboardEventTitle } from "./event-title";
import { DashboardSectionHeader } from "./section-header";
import type { DashboardData } from "../dashboard-types";
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
  onSelectBooking: (id: string) => void;
};

export function TeamActivityColumn({ data, filtered, activeSport, hasActiveFilter, now, onSelectBooking }: Props) {
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
    return events.filter((e) => venueToneFromEvent(e) === homeAwayFilter);
  }, [filtered?.upcomingEvents, data.upcomingEvents, homeAwayFilter]);

  const cappedEvents = useMemo(() => filteredEvents.slice(0, 10), [filteredEvents]);

  function eventBorder(e: DashboardData["upcomingEvents"][number]) {
    return VENUE_TONES[venueToneFromEvent(e)].railClass;
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
      <span className="px-0.5 text-xs font-semibold text-muted-foreground">Team activity</span>

      {/* Team Checkouts */}
      <ScaleIn delay={0}>
      <Card elevation="flat">
        <DashboardSectionHeader title="Checked out" href="/bookings?tab=checkouts" count={teamCheckoutsCount} />
        {visibleTeamCheckouts.length === 0 ? (
          <div className="flex min-h-16 items-center justify-center gap-2 px-4 py-3 text-center text-sm text-muted-foreground"><InboxIcon className="size-4 opacity-40" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
        ) : (
          <CardContent className="p-0">
            {visibleTeamCheckouts.map((c) => {
              return (
                <DashboardBookingRow
                  key={c.id}
                  booking={c}
                  now={now}
                  accent={dashboardBookingAccent(c, now, "checkout")}
                  showDueBadge
                  onSelectBooking={onSelectBooking}
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
        <Card elevation="flat">
          <DashboardSectionHeader title="Awaiting pickup" href={PENDING_PICKUPS_HREF} count={pendingPickupsCount} />
          <CardContent className="p-0">
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
        <Card elevation="flat">
          <DashboardSectionHeader title="Stale reservations" href={STALE_RESERVATIONS_HREF} count={staleReservationsCount} />
          <CardContent className="p-0">
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
      <Card elevation="flat">
        <DashboardSectionHeader title="Reserved" href="/bookings?tab=reservations" count={teamReservationsCount} />
        {visibleTeamReservations.length === 0 ? (
          <div className="flex min-h-16 items-center justify-center gap-2 px-4 py-3 text-center text-sm text-muted-foreground"><InboxIcon className="size-4 opacity-40" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
        ) : (
          <CardContent className="p-0">
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
      <Card elevation="flat">
        <DashboardSectionHeader
          title="Upcoming events"
          href="/schedule"
          className="grid-cols-1 gap-y-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-y-0"
          actionClassName="col-start-1 row-start-2 justify-self-start xl:col-start-2 xl:row-start-1 xl:justify-self-end"
          action={
            <ToggleGroup
              type="single"
              value={homeAwayFilter}
              onValueChange={(v) => v && setHomeAwayFilter(v as HomeAwayFilter)}
              aria-label="Venue filter"
              className="shrink-0"
            >
              {VENUE_FILTER_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "h-8 px-2 text-xs data-[state=on]:shadow-sm",
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
          <CardContent className="p-0">
            {cappedEvents.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "group flex min-h-[4.5rem] w-full items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-inherit no-underline transition-colors hover:bg-muted/45 [&+&]:border-t [&+&]:border-border/40",
                  eventBorder(e),
                )}
              >
                <Link href={`/events/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground ring-1 ring-foreground/5">
                    <CalendarDaysIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-bold text-foreground">{dashboardEventTitle(e)}</span>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug text-muted-foreground">
                      <span>
                        {formatDayLabel(e.startsAt, now, e.allDay)}{e.allDay ? " \u2013 All day" : `, ${formatTimeShort(e.startsAt)} \u2013 ${formatTimeShort(e.endsAt)}`}
                      </span>
                      {e.location && <span className="text-muted-foreground/40" aria-hidden="true">·</span>}
                      {e.location && <span className="truncate">{e.location}</span>}
                      {e.callTime && <span className="text-muted-foreground/40" aria-hidden="true">·</span>}
                      {e.callTime && <span>Call {formatTimeShort(e.callTime)}</span>}
                    </span>
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
