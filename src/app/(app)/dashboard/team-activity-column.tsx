"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CalendarCheckIcon, CalendarIcon, ClipboardCheckIcon, InboxIcon, PackageIcon } from "lucide-react";
import { formatDueLabel, formatEventDateTime, isDueToday } from "@/lib/format";
import { UserAvatar, GearAvatarStack, ShiftAvatarStack } from "./dashboard-avatars";
import type { DashboardData } from "../dashboard-types";
import type { FilteredDashboardData } from "@/hooks/use-dashboard-filters";

type Props = {
  data: DashboardData;
  filtered: FilteredDashboardData | null;
  activeSport: string | null;
  now: Date;
  onSelectBooking: (id: string) => void;
};

export function TeamActivityColumn({ data, filtered, activeSport, now, onSelectBooking }: Props) {
  return (
    <div className="dashboard-col dashboard-col-right">
      <span className="dashboard-col-label">Team Activity</span>

      {/* Team Checkouts */}
      <Card>
        <a href="/checkouts" className="card-header-link">
          <h2>Checked out</h2>
          <Badge variant="gray" size="sm">{data.teamCheckouts.total}</Badge>
        </a>
        {(filtered?.teamCheckouts ?? data.teamCheckouts.items).length === 0 ? (
          <div className="empty-section"><InboxIcon className="empty-section-icon" />{activeSport ? `No ${activeSport} checkouts` : "No team checkouts right now"}</div>
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
                      {c.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{c.refNumber}</Badge>}
                      {c.title}
                    </span>
                    <span className="ops-row-meta">
                      <UserAvatar initials={c.requesterInitials} avatarUrl={c.requesterAvatarUrl} />
                      {c.requesterName} &ndash; {c.itemCount} item{c.itemCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ops-row-right">
                    <Badge variant={c.isOverdue ? "red" : isDueToday(c.endsAt, now) ? "orange" : "gray"} size="sm">{dueLabel}</Badge>
                    <GearAvatarStack items={c.items} totalCount={c.itemCount} />
                  </div>
                </button>
              );
            })}
            {!activeSport && data.teamCheckouts.total > data.teamCheckouts.items.length && (
              <a href="/checkouts" className="view-all-link">View all {data.teamCheckouts.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>

      {/* Team Reservations */}
      <Card>
        <a href="/reservations" className="card-header-link">
          <h2>Reserved</h2>
          <Badge variant="gray" size="sm">{data.teamReservations.total}</Badge>
        </a>
        {(filtered?.teamReservations ?? data.teamReservations.items).length === 0 ? (
          <div className="empty-section"><InboxIcon className="empty-section-icon" />{activeSport ? `No ${activeSport} reservations` : "No team reservations right now"}</div>
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
                    {r.refNumber && <Badge variant="gray" size="sm" className="mr-1.5">{r.refNumber}</Badge>}
                    {r.title}
                  </span>
                  <span className="ops-row-meta">
                    <UserAvatar initials={r.requesterInitials} avatarUrl={r.requesterAvatarUrl} />
                    {r.requesterName} &ndash; {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <GearAvatarStack items={r.items} totalCount={r.itemCount} />
              </button>
            ))}
            {!activeSport && data.teamReservations.total > data.teamReservations.items.length && (
              <a href="/reservations" className="view-all-link">View all {data.teamReservations.total} &rarr;</a>
            )}
          </CardContent>
        )}
      </Card>

      {/* Upcoming Events */}
      <Card>
        <a href="/events" className="card-header-link">
          <h2>Upcoming events</h2>
        </a>
        {(filtered?.upcomingEvents ?? data.upcomingEvents).length === 0 ? (
          <div className="empty-section"><CalendarIcon className="empty-section-icon" />{activeSport ? `No ${activeSport} events` : "No upcoming events"}</div>
        ) : (
          <CardContent className="p-0 py-1">
            {(filtered?.upcomingEvents ?? data.upcomingEvents).map((e) => {
              const titleParam = encodeURIComponent(e.title);
              const startsParam = encodeURIComponent(e.startsAt);
              const endsParam = encodeURIComponent(e.endsAt);
              const locParam = e.locationId ? `&locationId=${e.locationId}` : "";
              return (
                <div key={e.id} className="ops-row event-row-clickable">
                  <a href={`/events/${e.id}`} className="ops-row-main no-underline">
                    <span className="ops-row-title">
                      {e.sportCode && <Badge variant="sport" size="sm" className="mr-1.5">{e.sportCode}</Badge>}
                      {e.opponent ? `vs ${e.opponent}` : e.title}
                    </span>
                    <span className="ops-row-meta">
                      {formatEventDateTime(e.startsAt, e.endsAt, e.allDay)}
                      {e.location && ` \u00B7 ${e.location}`}
                    </span>
                  </a>
                  <div className="event-row-right">
                    <ShiftAvatarStack assignedUsers={e.assignedUsers} totalSlots={e.totalShiftSlots} />
                    {e.isHome !== null && (
                      <Badge variant={e.isHome ? "green" : "gray"}>
                        {e.isHome ? "Home" : "Away"}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="event-action-trigger">
                              <PackageIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Create booking for this event</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/checkouts?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}>
                            <ClipboardCheckIcon className="mr-2 size-4" />
                            New checkout
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/reservations?title=${titleParam}&startsAt=${startsParam}&endsAt=${endsParam}${locParam}`}>
                            <CalendarCheckIcon className="mr-2 size-4" />
                            New reservation
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
