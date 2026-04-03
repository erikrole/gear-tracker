import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, EyeOffIcon, UserIcon } from "lucide-react";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { sportLabel } from "@/lib/sports";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalendarEntry, Shift } from "./types";
import {
  ACTIVE_STATUSES,
  AREA_LABELS,
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
  isStaff: boolean;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  onSelectGroup: (groupId: string | null) => void;
  onHideEvent?: (eventId: string) => void;
};

const AREA_BADGE_VARIANT: Record<string, "green" | "purple" | "orange" | "blue"> = {
  VIDEO: "green",
  PHOTO: "purple",
  COMMS: "orange",
  GRAPHICS: "blue",
};

function shiftAssignee(shift: Shift) {
  const active = shift.assignments.find((a) => ACTIVE_STATUSES.includes(a.status));
  return active?.user ?? null;
}

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
  isStaff,
  expandedRowId,
  setExpandedRowId,
  onSelectGroup,
  onHideEvent,
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
          <p className="text-muted-foreground mb-2">
            {loadError === "network"
              ? "You appear to be offline. Check your connection and try again."
              : "Something went wrong loading schedule data."}
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
          {/* ── Desktop: Asana-style expandable shift schedule ── */}
          <div className="max-md:hidden">
            {groupedEntries.map(([dateKey, groupEntries], groupIdx) => {
              const isGroupToday =
                new Date(dateKey).toDateString() === new Date().toDateString();
              return (
                <div key={dateKey}>
                  <div className={`event-date-header ${isGroupToday ? "event-date-header-today" : ""}`}>
                    {formatDate(groupEntries[0].startsAt)}
                    <span className="event-date-count">
                      {groupEntries.length} event{groupEntries.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <table className={`data-table data-table-grouped${groupIdx === 0 ? " data-table-show-head" : ""}`}>
                    <colgroup>
                      <col style={{ width: 28 }} />
                      <col />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 140 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Event</th>
                        <th>Area</th>
                        <th>Assigned</th>
                        <th>Time</th>
                        <th>Sport</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((entry) => {
                        const isExpanded = expandedRowId === entry.id;
                        const hasShifts = entry.shifts.length > 0;
                        const shiftStatus = currentUserId ? userShiftStatus(entry, currentUserId) : null;

                        return (
                          <EventRows
                            key={entry.id}
                            entry={entry}
                            isExpanded={isExpanded}
                            hasShifts={hasShifts}
                            shiftStatus={shiftStatus}
                            isStaff={isStaff}
                            onToggle={() => setExpandedRowId(isExpanded ? null : entry.id)}
                            onSelectGroup={() => onSelectGroup(entry.shiftGroupId)}
                            onHide={onHideEvent ? () => onHideEvent(entry.id) : undefined}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* ── Mobile: card list ── */}
          <div className="hidden max-md:flex flex-col">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedRowId === entry.id;
              const shiftStatus = currentUserId ? userShiftStatus(entry, currentUserId) : null;

              return (
                <div key={entry.id} className="block px-4 py-3 border-b border-[var(--border-light)] last:border-b-0 no-underline text-inherit active:bg-[var(--panel-hover)]">
                  <button
                    className="w-full text-left p-3"
                    onClick={() => entry.shifts.length > 0
                      ? setExpandedRowId(isExpanded ? null : entry.id)
                      : undefined}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        {entry.shifts.length > 0 && (
                          isExpanded
                            ? <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
                            : <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        {entry.opponent
                          ? `${entry.isHome === true ? "vs " : "at "}${entry.opponent}`
                          : entry.summary}
                      </span>
                      <div className="flex items-center gap-1">
                        {shiftStatus && (
                          <Badge variant={shiftStatus === "Confirmed" ? "green" : "orange"} size="sm">
                            {shiftStatus}
                          </Badge>
                        )}
                        {entry.coverage && (
                          <Badge variant={coverageVariant(entry.coverage.percentage)} size="sm">
                            {entry.coverage.filled}/{entry.coverage.total}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      <span>
                        {formatDateShort(entry.startsAt)}{" "}
                        {entry.allDay ? "All day" : formatTimeShort(entry.startsAt)}
                      </span>
                      {entry.sportCode && (
                        <span>{sportLabel(entry.sportCode)}</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded shift rows on mobile */}
                  {isExpanded && entry.shifts.length > 0 && (
                    <div className="border-t border-border">
                      {entry.shifts.map((shift) => {
                        const user = shiftAssignee(shift);
                        return (
                          <div
                            key={shift.id}
                            className="flex items-center gap-3 px-3 py-2 pl-8 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                            tabIndex={0}
                            role="link"
                            onClick={() => onSelectGroup(entry.shiftGroupId)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectGroup(entry.shiftGroupId); } }}
                          >
                            <Badge variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"} size="sm" className="w-16 justify-center">
                              {AREA_LABELS[shift.area] ?? shift.area}
                            </Badge>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {user ? (
                                <>
                                  <Avatar className="size-6 shrink-0">
                                    <AvatarFallback className={`text-[10px] font-medium ${getAvatarColor(user.name)}`}>
                                      {getInitials(user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm truncate">{user.name}</span>
                                </>
                              ) : (
                                <>
                                  <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                                    <UserIcon className="size-3 text-muted-foreground/40" />
                                  </div>
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {shift.workerType === "FT" ? "Staff" : "Student"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

/* ── Event parent + shift child rows (desktop) ── */

function EventRows({
  entry,
  isExpanded,
  hasShifts,
  shiftStatus,
  isStaff,
  onToggle,
  onSelectGroup,
  onHide,
}: {
  entry: CalendarEntry;
  isExpanded: boolean;
  hasShifts: boolean;
  shiftStatus: string | null;
  isStaff: boolean;
  onToggle: () => void;
  onSelectGroup: () => void;
  onHide?: () => void;
}) {
  const eventTitle = entry.opponent
    ? `${entry.sportCode ? sportLabel(entry.sportCode) + " " : ""}${entry.isHome === true ? "vs " : "at "}${entry.opponent}`
    : entry.summary;

  const timeStr = entry.allDay
    ? "All day"
    : `${formatTime(entry.startsAt)} – ${formatTime(entry.endsAt)}`;

  return (
    <>
      {/* Parent event row */}
      <tr
        className={`group/row ${hasShifts ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]" : ""} ${isExpanded ? "bg-accent/30" : ""}`}
        tabIndex={hasShifts ? 0 : undefined}
        role={hasShifts ? "link" : undefined}
        onClick={hasShifts ? onToggle : undefined}
        onKeyDown={hasShifts ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } } : undefined}
      >
        <td className="px-1">
          {hasShifts && (
            isExpanded
              ? <ChevronDownIcon className="size-4 text-muted-foreground" />
              : <ChevronRightIcon className="size-4 text-muted-foreground" />
          )}
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link
              href={`/events/${entry.id}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {eventTitle}
            </Link>
            {entry.coverage && (
              <Badge variant={coverageVariant(entry.coverage.percentage)} size="sm">
                {entry.coverage.filled}/{entry.coverage.total}
              </Badge>
            )}
            {entry.isPremier && (
              <Badge variant="blue" size="sm">Premier</Badge>
            )}
            {shiftStatus && (
              <Badge variant={shiftStatus === "Confirmed" ? "green" : "orange"} size="sm">
                {shiftStatus}
              </Badge>
            )}
          </div>
        </td>
        <td></td>
        <td>
          {/* Unassigned placeholder for the event row */}
        </td>
        <td className="text-sm text-muted-foreground whitespace-nowrap">{timeStr}</td>
        <td>
          <div className="flex items-center gap-1.5">
            {entry.sportCode && (
              <Badge variant="purple" size="sm">{sportLabel(entry.sportCode)}</Badge>
            )}
            {isStaff && onHide && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onHide(); }}
                  >
                    <EyeOffIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide event from schedule</TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
      </tr>

      {/* Child shift rows */}
      {isExpanded && entry.shifts.map((shift) => {
        const user = shiftAssignee(shift);
        // Suppress shift call times for away events (no call times on road trips)
        const isAway = entry.isHome !== true;
        const shiftTime = isAway ? "—" : `${formatTime(shift.startsAt)} – ${formatTime(shift.endsAt)}`;
        const workerLabel = shift.workerType === "FT" ? "FT" : "ST";

        return (
          <tr
            key={shift.id}
            className="bg-muted/20 hover:bg-accent/40 cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
            tabIndex={0}
            role="link"
            onClick={() => onSelectGroup()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectGroup(); } }}
          >
            <td></td>
            <td>
              <span className="text-sm text-muted-foreground pl-4">
                {workerLabel} · {AREA_LABELS[shift.area] ?? shift.area}
              </span>
            </td>
            <td>
              <Badge variant={AREA_BADGE_VARIANT[shift.area] ?? "gray"} size="sm">
                {AREA_LABELS[shift.area] ?? shift.area}
              </Badge>
            </td>
            <td>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <Avatar className="size-6">
                      <AvatarFallback className={`text-[10px] font-medium ${getAvatarColor(user.name)}`}>
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{user.name}</span>
                  </>
                ) : (
                  <>
                    <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <UserIcon className="size-3 text-muted-foreground/40" />
                    </div>
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  </>
                )}
              </div>
            </td>
            <td className="text-sm text-muted-foreground whitespace-nowrap">{shiftTime}</td>
            <td></td>
          </tr>
        );
      })}
    </>
  );
}
