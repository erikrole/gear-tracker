import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { sportLabel } from "@/lib/sports";
import { formatTimeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "./types";
import { ACTIVE_STATUSES, AREA_LABELS, coverageDot } from "./types";

type CalendarViewProps = {
  entries: CalendarEntry[];
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  expandedDay: number | null;
  setExpandedDay: (d: number | null) => void;
  onSelectGroup: (groupId: string | null) => void;
};

function isToday(calMonth: Date, day: number) {
  const now = new Date();
  return (
    calMonth.getFullYear() === now.getFullYear() &&
    calMonth.getMonth() === now.getMonth() &&
    day === now.getDate()
  );
}

/** Tailwind color classes for home/away/neutral booking chips */
function bookingColorClass(entry: CalendarEntry): string {
  if (entry.isHome === true) return "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20";
  if (entry.isHome === false) return "bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20";
  return "bg-muted text-muted-foreground hover:bg-muted/80";
}

function buildTooltipContent(entry: CalendarEntry): React.ReactNode {
  const timeStr = entry.allDay
    ? "All day"
    : `${formatTimeShort(entry.startsAt)} – ${formatTimeShort(entry.endsAt)}`;

  const assignedUsers = entry.shifts.flatMap((s) =>
    s.assignments
      .filter((a) => ACTIVE_STATUSES.includes(a.status))
      .map((a) => ({ name: a.user.name, area: AREA_LABELS[s.area] ?? s.area }))
  );

  return (
    <div className="text-xs flex flex-col gap-1 max-w-[220px]">
      <div className="font-semibold text-sm">{entry.summary}</div>
      <div className="text-muted-foreground">{timeStr}</div>
      {assignedUsers.length > 0 && (
        <div className="text-muted-foreground">
          {assignedUsers.map((u, i) => (
            <span key={i}>{i > 0 && ", "}{u.name} ({u.area})</span>
          ))}
        </div>
      )}
      {entry.coverage && (
        <div className="text-muted-foreground">
          {entry.coverage.filled}/{entry.coverage.total} filled
        </div>
      )}
    </div>
  );
}

export function CalendarView({
  entries,
  calMonth,
  setCalMonth,
  expandedDay,
  setExpandedDay,
  onSelectGroup,
}: CalendarViewProps) {
  const calCells = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    return cells;
  }, [calMonth]);

  const calEntriesByDay = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();
    for (const entry of entries) {
      const d = new Date(entry.startsAt).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(entry);
    }
    return map;
  }, [entries]);

  function prevMonth() {
    setCalMonth(
      new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1),
    );
  }
  function nextMonth() {
    setCalMonth(
      new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1),
    );
  }
  function goCalToday() {
    const d = new Date();
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  const bookingBase = "block w-full text-left px-1 py-0.5 text-[10px] font-medium rounded truncate mb-px leading-[1.4]";

  return (
    <Card className="mb-1">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <CardTitle className="text-center min-w-[160px]">
            {calMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
          <Button variant="outline" size="icon" className="size-8" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goCalToday}>
          Today
        </Button>
      </CardHeader>
      <div className="p-4">
        <div className="hidden max-md:block text-center py-6 px-4 text-muted-foreground text-sm">
          Switch to List view for the best mobile experience.
        </div>
        <div className="hidden md:grid grid-cols-7 gap-px bg-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 bg-background">
              {d}
            </div>
          ))}
          {calCells.map((cell, i) => {
            const dayEntries = cell.day
              ? calEntriesByDay.get(cell.day)
              : undefined;
            const isExpanded = expandedDay === cell.day;
            const visibleEntries = isExpanded
              ? dayEntries
              : dayEntries?.slice(0, 3);
            const hiddenCount = (dayEntries?.length ?? 0) - 3;
            const today = cell.day ? isToday(calMonth, cell.day) : false;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-20 p-1 overflow-hidden",
                  cell.day === null ? "bg-background" : "bg-card",
                  today && "bg-primary/5",
                  isExpanded && "z-10 relative shadow-md",
                )}
              >
                {cell.day && (
                  <>
                    <span
                      className={cn(
                        "text-xs font-medium text-muted-foreground inline-flex items-center justify-center size-[22px]",
                        today && "bg-destructive text-destructive-foreground rounded-full",
                      )}
                    >
                      {cell.day}
                    </span>
                    {visibleEntries?.map((entry) =>
                      entry.shiftGroupId ? (
                        <Tooltip key={entry.id}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                bookingBase,
                                "flex items-center gap-1 cursor-pointer",
                                bookingColorClass(entry),
                              )}
                              onClick={() =>
                                onSelectGroup(entry.shiftGroupId)
                              }
                            >
                              {entry.coverage && (
                                <span
                                  className="size-1.5 rounded-full flex-shrink-0"
                                  style={{
                                    background: coverageDot(
                                      entry.coverage.percentage,
                                    ),
                                  }}
                                />
                              )}
                              <span className="truncate">
                                {entry.sportCode && entry.opponent
                                  ? `${sportLabel(entry.sportCode)} ${entry.isHome === false ? "at" : "vs"} ${entry.opponent}`
                                  : entry.summary}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {buildTooltipContent(entry)}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip key={entry.id}>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/events/${entry.id}`}
                              className={cn(bookingBase, bookingColorClass(entry))}
                            >
                              {entry.sportCode && entry.opponent
                                ? `${sportLabel(entry.sportCode)} ${entry.isHome === false ? "at" : "vs"} ${entry.opponent}`
                                : entry.summary}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {buildTooltipContent(entry)}
                          </TooltipContent>
                        </Tooltip>
                      ),
                    )}
                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="block text-[10px] text-muted-foreground cursor-pointer hover:text-foreground px-1"
                        onClick={() => setExpandedDay(cell.day)}
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                    {isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="block text-[10px] text-muted-foreground cursor-pointer hover:text-foreground px-1"
                        onClick={() => setExpandedDay(null)}
                      >
                        show less
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
