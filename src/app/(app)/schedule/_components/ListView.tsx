import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarEntry } from "./types";
import {
  AREAS,
  AREA_LABELS,
  areaCoverage,
  coverageVariant,
  formatDate,
  formatTime,
  userShiftStatus,
} from "./types";

type ListViewProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  groupedEntries: [string, CalendarEntry[]][];
  loading: boolean;
  loadError: false | "network" | "server";
  loadData: () => void;
  myShiftsOnly: boolean;
  setMyShiftsOnly: (v: boolean) => void;
  includePast: boolean;
  hasFilters: boolean;
  currentUserId: string;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onSelectGroup: (groupId: string | null) => void;
};

export function ListView({
  entries,
  filteredEntries,
  groupedEntries,
  loading,
  loadError,
  loadData,
  myShiftsOnly,
  setMyShiftsOnly,
  includePast,
  hasFilters,
  currentUserId,
  expandedRowId,
  setExpandedRowId,
  onSelectGroup,
}: ListViewProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {myShiftsOnly ? "My" : includePast ? "All" : "Upcoming"} Events{" "}
          ({filteredEntries.length !== entries.length
            ? `${filteredEntries.length} of ${entries.length}`
            : filteredEntries.length})
        </CardTitle>
      </CardHeader>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : loadError ? (
        <div className="p-4 text-center">
          <p className="text-secondary mb-2">
            {loadError === "network"
              ? "You appear to be offline. Check your connection and try again."
              : "Something went wrong loading schedule data — usually temporary."}
          </p>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={myShiftsOnly ? "No shifts assigned" : "No events found"}
          description={
            myShiftsOnly
              ? "You don't have any upcoming shift assignments."
              : hasFilters
                ? "Try adjusting your filters."
                : "No upcoming events. Check Settings → Calendar Sources to add an ICS feed."
          }
          actionLabel={
            myShiftsOnly
              ? "Show all events"
              : hasFilters
                ? undefined
                : "Calendar Sources"
          }
          actionHref={
            myShiftsOnly
              ? undefined
              : hasFilters
                ? undefined
                : "/settings/calendar-sources"
          }
          onAction={
            myShiftsOnly ? () => setMyShiftsOnly(false) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop: date-grouped table */}
          <div className="event-list-grouped schedule-table-desktop">
            {groupedEntries.map(([dateKey, groupEntries], groupIdx) => {
              const isGroupToday =
                new Date(dateKey).toDateString() ===
                new Date().toDateString();
              return (
                <div
                  key={dateKey}
                >
                  <div
                    className={`event-date-header ${isGroupToday ? "event-date-header-today" : ""}`}
                  >
                    {formatDate(groupEntries[0].startsAt)}
                    <span className="event-date-count">
                      {groupEntries.length} event
                      {groupEntries.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <table
                    className={`data-table data-table-grouped${groupIdx === 0 ? " data-table-show-head" : ""}`}
                  >
                    <colgroup>
                      <col className="col-sport" />
                      <col className="col-event" />
                      <col className="col-time" />
                      <col className="col-location" />
                      <col className="col-coverage" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Sport</th>
                        <th>Event</th>
                        <th>Time</th>
                        <th>Location</th>
                        <th className="text-center">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((entry) => {
                        const isExpRow = expandedRowId === entry.id;
                        const shiftStatus = currentUserId
                          ? userShiftStatus(entry, currentUserId)
                          : null;
                        return (
                          <>
                            <tr
                              key={entry.id}
                              className={
                                entry.shiftGroupId ? "cursor-pointer" : ""
                              }
                              onClick={
                                entry.shiftGroupId
                                  ? () =>
                                      onSelectGroup(entry.shiftGroupId)
                                  : undefined
                              }
                            >
                              <td>
                                {entry.sportCode && (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {sportLabel(entry.sportCode)}
                                  </span>
                                )}
                              </td>
                              <td className="font-semibold">
                                <Link
                                  href={`/events/${entry.id}`}
                                  className="row-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {entry.opponent
                                    ? `${entry.isHome === true ? "vs " : entry.isHome === false ? "at " : ""}${entry.opponent}`
                                    : entry.summary}
                                </Link>
                                {entry.isPremier && (
                                  <Badge
                                    variant="blue"
                                    size="sm"
                                    className="ml-1"
                                  >
                                    Premier
                                  </Badge>
                                )}
                                {shiftStatus && (
                                  <Badge
                                    variant={
                                      shiftStatus === "Confirmed"
                                        ? "green"
                                        : "orange"
                                    }
                                    size="sm"
                                    className="ml-1"
                                  >
                                    {shiftStatus}
                                  </Badge>
                                )}
                              </td>
                              <td>
                                {entry.allDay
                                  ? "All day"
                                  : `${formatTime(entry.startsAt)} – ${formatTime(entry.endsAt)}`}
                              </td>
                              <td className="text-secondary">
                                {entry.location
                                  ? entry.location.name
                                  : entry.rawLocationText ?? null}
                              </td>
                              <td className="text-center">
                                {entry.coverage ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedRowId(
                                        isExpRow ? null : entry.id,
                                      );
                                    }}
                                    title="Click to expand coverage breakdown"
                                  >
                                    {isExpRow ? (
                                      <ChevronDownIcon className="size-3 text-secondary" />
                                    ) : (
                                      <ChevronRightIcon className="size-3 text-secondary" />
                                    )}
                                    <Badge
                                      variant={coverageVariant(
                                        entry.coverage.percentage,
                                      )}
                                    >
                                      {entry.coverage.filled}/
                                      {entry.coverage.total}
                                    </Badge>
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                            {/* Inline coverage expansion */}
                            {isExpRow && entry.coverage && (
                              <tr
                                key={`${entry.id}-exp`}
                                className="bg-muted/30"
                              >
                                <td colSpan={5}>
                                  <div className="flex flex-wrap gap-4 py-2 px-3">
                                    {AREAS.map((area) => {
                                      const ac = areaCoverage(
                                        entry.shifts,
                                        area,
                                      );
                                      if (ac.total === 0) return null;
                                      return (
                                        <div
                                          key={area}
                                          className="flex flex-col items-center gap-1"
                                        >
                                          <span className="text-xs text-secondary font-medium">
                                            {AREA_LABELS[area]}
                                          </span>
                                          <Badge
                                            variant={coverageVariant(
                                              ac.total > 0
                                                ? (ac.filled / ac.total) *
                                                    100
                                                : 0,
                                            )}
                                          >
                                            {ac.filled}/{ac.total}
                                          </Badge>
                                          {ac.assignedUsers.length > 0 && (
                                            <AvatarGroup max={3}>
                                              {ac.assignedUsers.map((u) => (
                                                <Avatar
                                                  key={u.id}
                                                  className="size-6"
                                                  title={u.name}
                                                >
                                                  <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-medium">
                                                    {u.name
                                                      .charAt(0)
                                                      .toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ))}
                                            </AvatarGroup>
                                          )}
                                          {ac.filled < ac.total &&
                                            entry.shiftGroupId && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-6 px-2"
                                                onClick={() =>
                                                  onSelectGroup(
                                                    entry.shiftGroupId,
                                                  )
                                                }
                                              >
                                                Assign
                                              </Button>
                                            )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Mobile cards */}
          <div className="schedule-mobile-list">
            {filteredEntries.map((entry) => {
              const shiftStatus = currentUserId
                ? userShiftStatus(entry, currentUserId)
                : null;
              return (
                <Link
                  key={entry.id}
                  href={`/events/${entry.id}`}
                  className="schedule-mobile-card no-underline block cursor-pointer"
                >
                  <div className="flex-between mb-1">
                    <span className="font-semibold">
                      {entry.opponent
                        ? `${entry.isHome === true ? "vs " : entry.isHome === false ? "at " : ""}${entry.opponent}`
                        : entry.summary}
                    </span>
                    <div className="flex items-center gap-1">
                      {shiftStatus && (
                        <Badge
                          variant={
                            shiftStatus === "Confirmed" ? "green" : "orange"
                          }
                          size="sm"
                        >
                          {shiftStatus}
                        </Badge>
                      )}
                      {entry.coverage && (
                        <Badge
                          variant={coverageVariant(
                            entry.coverage.percentage,
                          )}
                        >
                          {entry.coverage.filled}/{entry.coverage.total}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-secondary flex gap-2 flex-wrap">
                    <span>
                      {formatDateShort(entry.startsAt)}{" "}
                      {entry.allDay
                        ? "All day"
                        : formatTimeShort(entry.startsAt)}
                    </span>
                    {entry.sportCode && (
                      <span className="text-xs font-medium text-muted-foreground">{sportLabel(entry.sportCode)}</span>
                    )}
                    {entry.isPremier && (
                      <Badge variant="blue">Premier</Badge>
                    )}
                    {entry.location && (
                      <Badge variant="blue" size="sm">
                        {entry.location.name}
                      </Badge>
                    )}
                  </div>
                  {entry.coverage && entry.shifts.length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {AREAS.map((area) => {
                        const ac = areaCoverage(entry.shifts, area);
                        if (ac.total === 0) return null;
                        return (
                          <span key={area} className="text-xs">
                            {AREA_LABELS[area]}:{" "}
                            <Badge
                              variant={coverageVariant(
                                ac.total > 0
                                  ? (ac.filled / ac.total) * 100
                                  : 0,
                              )}
                              size="sm"
                            >
                              {ac.filled}/{ac.total}
                            </Badge>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
