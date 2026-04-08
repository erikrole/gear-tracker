"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { sportLabel } from "@/lib/sports";
import {
  type CalendarEntry,
  coverageDot,
  coverageVariant,
  userHasShift,
  formatTime,
} from "./types";

type WeekViewProps = {
  entries: CalendarEntry[];
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  loading: boolean;
  currentUserId: string;
  currentUserRole: string;
  myShiftsOnly: boolean;
  onSelectGroup: (groupId: string | null) => void;
};

/** Generate 7 Date objects starting from weekStart (Monday) */
function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Short day label: "Mon 7" */
function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

/** Full header label: "Mon, Apr 7" */
function dayHeaderLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function eventBookingClass(entry: CalendarEntry): string {
  if (entry.isHome === true) return "week-event week-event-home";
  // Neutral sites (null) treated as away
  return "week-event week-event-away";
}

function eventDisplayName(entry: CalendarEntry): string {
  if (entry.sportCode && entry.opponent) {
    return `${sportLabel(entry.sportCode)} ${entry.isHome === true ? "vs" : "at"} ${entry.opponent}`;
  }
  return entry.summary;
}

/** Navigate week: -1 = prev, +1 = next */
function shiftWeek(weekStart: Date, delta: number): Date {
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + 7 * delta);
  return d;
}

/** Get Monday of current week */
function getThisMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ───── Event Card ───── */

function EventCard({
  entry,
  currentUserId,
  currentUserRole,
  myShiftsOnly,
  onSelectGroup,
}: {
  entry: CalendarEntry;
  currentUserId: string;
  currentUserRole: string;
  myShiftsOnly: boolean;
  onSelectGroup: (groupId: string | null) => void;
}) {
  const isStaff = currentUserRole === "ADMIN" || currentUserRole === "STAFF";
  const hasShift = userHasShift(entry, currentUserId);
  const canOpenPanel = entry.shiftGroupId && (isStaff || (entry.isPremier && !isStaff));

  const content = (
    <>
      {/* Time */}
      <span className="text-[10px] text-muted-foreground leading-tight">
        {entry.allDay ? "All day" : formatTime(entry.startsAt)}
      </span>

      {/* Event name */}
      <span className="text-xs font-medium leading-tight truncate">
        {eventDisplayName(entry)}
      </span>

      {/* Coverage + user assignment */}
      <div className="flex items-center gap-1.5 mt-0.5">
        {entry.coverage && (
          <>
            <span
              className="size-1.5 rounded-full flex-shrink-0"
              style={{ background: coverageDot(entry.coverage.percentage) }}
            />
            <Badge variant={coverageVariant(entry.coverage.percentage)} size="sm" className="text-[10px] px-1.5 py-0">
              {entry.coverage.filled}/{entry.coverage.total}
            </Badge>
          </>
        )}
        {hasShift && (
          <Badge variant="blue" size="sm" className="text-[10px] px-1.5 py-0">
            You
          </Badge>
        )}
      </div>
    </>
  );

  const baseClass = `${eventBookingClass(entry)} ${myShiftsOnly && !hasShift ? "opacity-50" : ""} ${hasShift ? "ring-1 ring-[var(--accent)]" : ""}`;

  if (canOpenPanel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={baseClass}
            onClick={() => onSelectGroup(entry.shiftGroupId)}
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {entry.summary}
          {entry.coverage && ` (${entry.coverage.filled}/${entry.coverage.total} filled)`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={`/events/${entry.id}`} className={baseClass}>
      {content}
    </Link>
  );
}

/* ───── Loading Skeleton ───── */

function WeekSkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="week-grid max-md:hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="week-day-col">
            <Skeleton className="h-3 w-12 mb-2" />
            <Skeleton className="h-16 w-full mb-1.5" />
            <Skeleton className="h-16 w-full mb-1.5" />
          </div>
        ))}
      </div>
      {/* Mobile skeleton */}
      <div className="md:hidden border rounded-lg overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-3 border-b last:border-b-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-6" />
          </div>
        ))}
      </div>
    </>
  );
}

/* ───── Mobile Day Section ───── */

function MobileDaySection({
  day,
  entries,
  isToday,
  defaultExpanded,
  currentUserId,
  currentUserRole,
  myShiftsOnly,
  onSelectGroup,
}: {
  day: Date;
  entries: CalendarEntry[];
  isToday: boolean;
  defaultExpanded: boolean;
  currentUserId: string;
  currentUserRole: string;
  myShiftsOnly: boolean;
  onSelectGroup: (groupId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className={`border-b last:border-b-0 ${isToday ? "bg-[var(--accent-soft)]" : ""}`}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-between w-full px-3 py-2 text-left bg-transparent border-none cursor-pointer"
        >
          <span className={`text-sm font-medium ${isToday ? "text-[var(--accent)]" : ""}`}>
            {dayHeaderLabel(day)}
            {isToday && <span className="text-[10px] text-muted-foreground ml-1.5">Today</span>}
          </span>
          <span className="flex items-center gap-1.5">
            {entries.length > 0 && (
              <Badge variant="secondary" size="sm">{entries.length}</Badge>
            )}
            <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No events</p>
          ) : (
            entries.map((entry) => (
              <EventCard
                key={entry.id}
                entry={entry}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                myShiftsOnly={myShiftsOnly}
                onSelectGroup={onSelectGroup}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ───── Main WeekView ───── */

export function WeekView({
  entries,
  weekStart,
  setWeekStart,
  loading,
  currentUserId,
  currentUserRole,
  myShiftsOnly,
  onSelectGroup,
}: WeekViewProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const day of weekDays) {
      map.set(day.toDateString(), []);
    }
    for (const entry of entries) {
      const entryDate = new Date(entry.startsAt);
      const key = entryDate.toDateString();
      const dayEntries = map.get(key);
      if (dayEntries) dayEntries.push(entry);
    }
    // Sort each day's entries by start time
    for (const dayEntries of map.values()) {
      dayEntries.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [entries, weekDays]);

  const isThisWeek = isSameDay(weekStart, getThisMonday());

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
            aria-label="Previous week"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
            aria-label="Next week"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          {!isThisWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(getThisMonday())}
            >
              This week
            </Button>
          )}
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {weekRangeLabel(weekStart)}
        </span>
      </div>

      {/* Loading */}
      {loading && <WeekSkeleton />}

      {/* Desktop: 7-column grid */}
      {!loading && (
        <div className="week-grid max-md:hidden">
          {weekDays.map((day) => {
            const dayKey = day.toDateString();
            const dayEntries = entriesByDay.get(dayKey) ?? [];
            const isToday = isSameDay(day, today);

            return (
              <div key={dayKey} className={`week-day-col ${isToday ? "week-day-today" : ""}`}>
                <div className={`text-xs font-medium mb-2 ${isToday ? "text-[var(--accent)]" : "text-muted-foreground"}`}>
                  {dayLabel(day)}
                </div>
                {dayEntries.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-4">—</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayEntries.map((entry) => (
                      <EventCard
                        key={entry.id}
                        entry={entry}
                        currentUserId={currentUserId}
                        currentUserRole={currentUserRole}
                        myShiftsOnly={myShiftsOnly}
                        onSelectGroup={onSelectGroup}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile: collapsible day sections */}
      {!loading && (
        <div className="md:hidden border rounded-lg overflow-hidden">
          {weekDays.map((day) => {
            const dayKey = day.toDateString();
            const dayEntries = entriesByDay.get(dayKey) ?? [];
            const isToday = isSameDay(day, today);

            return (
              <MobileDaySection
                key={dayKey}
                day={day}
                entries={dayEntries}
                isToday={isToday}
                defaultExpanded={isToday}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                myShiftsOnly={myShiftsOnly}
                onSelectGroup={onSelectGroup}
              />
            );
          })}
        </div>
      )}

      {/* Empty state — all days empty */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No events this week</p>
          <p className="text-xs mt-1">Try navigating to a different week</p>
        </div>
      )}
    </div>
  );
}
