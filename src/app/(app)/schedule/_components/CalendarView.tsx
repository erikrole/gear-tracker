import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSwitchToList?: () => void;
};

function isToday(calMonth: Date, day: number) {
  const now = new Date();
  return (
    calMonth.getFullYear() === now.getFullYear() &&
    calMonth.getMonth() === now.getMonth() &&
    day === now.getDate()
  );
}

function buildTooltipContent(entry: CalendarEntry): React.ReactNode {
  const timeStr = entry.allDay
    ? "All day"
    : `${formatTimeShort(entry.startsAt)} – ${formatTimeShort(entry.endsAt)}`;

  const assignedUsers = entry.shifts.flatMap((s) =>
    s.assignments
      .filter((a) => ACTIVE_STATUSES.includes(a.status))
      .map((a) => ({ name: a.user.name, area: AREA_LABELS[s.area] ?? s.area })),
  );

  return (
    <div className="text-xs flex flex-col gap-1 max-w-[220px]">
      <div className="font-semibold text-sm">{entry.summary}</div>
      <div className="text-muted-foreground">{timeStr}</div>
      {assignedUsers.length > 0 && (
        <div className="text-muted-foreground">
          {assignedUsers.map((u, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {u.name} ({u.area})
            </span>
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

/* ── Event chip inside a calendar cell ── */

function EventChip({
  entry,
  onSelectGroup,
}: {
  entry: CalendarEntry;
  onSelectGroup: (groupId: string | null) => void;
}) {
  const title =
    entry.sportCode && entry.opponent
      ? `${sportLabel(entry.sportCode)} ${entry.isHome === false ? "at" : "vs"} ${entry.opponent}`
      : entry.summary;

  const barColor =
    entry.isHome === true
      ? "bg-[var(--green)]"
      : entry.isHome === false
        ? "bg-[var(--orange)]"
        : "bg-muted-foreground/30";

  const chipBg =
    entry.isHome === true
      ? "bg-[var(--green)]/10 hover:bg-[var(--green)]/18"
      : entry.isHome === false
        ? "bg-[var(--orange)]/10 hover:bg-[var(--orange)]/18"
        : "bg-muted/50 hover:bg-muted";

  const chipClass = cn(
    "flex items-stretch rounded-sm w-full text-left mb-px overflow-hidden transition-colors cursor-pointer",
  );

  const inner = (
    <>
      <div className={cn("w-[2.5px] flex-shrink-0", barColor)} />
      <div className={cn("flex-1 px-1 py-[2px] min-w-0", chipBg)}>
        <div className="flex items-center gap-1 min-w-0">
          {entry.coverage && (
            <span
              className="size-1.5 rounded-full flex-shrink-0"
              style={{ background: coverageDot(entry.coverage.percentage) }}
            />
          )}
          <span className="text-[10px] font-medium leading-[1.35] truncate">
            {title}
          </span>
        </div>
      </div>
    </>
  );

  if (entry.shiftGroupId) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={chipClass}
            onClick={() => onSelectGroup(entry.shiftGroupId)}
          >
            {inner}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          {buildTooltipContent(entry)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/events/${entry.id}`} className={chipClass}>
          {inner}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        {buildTooltipContent(entry)}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Main CalendarView ── */

export function CalendarView({
  entries,
  calMonth,
  onSwitchToList,
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

  return (
    <div className="mb-1">
      {/* ── Calendar Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <h2
            className="text-xl font-bold tracking-tight uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {calMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={goCalToday}>
          Today
        </Button>
      </div>

      {/* ── Mobile notice ── */}
      <div className="hidden max-md:flex flex-col items-center gap-3 py-8 px-4 text-muted-foreground text-sm border border-border/60 rounded-lg bg-muted/20 text-center">
        <span>Calendar view is best on desktop.</span>
        {onSwitchToList && (
          <Button variant="outline" size="sm" onClick={onSwitchToList}>
            Switch to List view
          </Button>
        )}
      </div>

      {/* ── Calendar Grid ── */}
      <div className="hidden md:block border border-border/60 rounded-lg overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/25">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
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
                  "min-h-[88px] p-1 overflow-hidden border-t border-border/40",
                  i % 7 !== 0 && "border-l border-l-border/40",
                  cell.day === null ? "bg-muted/15" : "bg-card",
                  today && "bg-[#A00000]/[0.04]",
                  isExpanded && "z-10 relative shadow-lg",
                )}
              >
                {cell.day && (
                  <>
                    {/* Date numeral */}
                    <div className="flex justify-center mb-1">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-[26px] text-sm leading-none rounded-full font-bold transition-colors",
                          today
                            ? "bg-[#A00000] text-white"
                            : "text-foreground hover:bg-muted/60",
                        )}
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {cell.day}
                      </span>
                    </div>

                    {/* Events */}
                    {visibleEntries?.map((entry) => (
                      <EventChip
                        key={entry.id}
                        entry={entry}
                        onSelectGroup={onSelectGroup}
                      />
                    ))}

                    {/* Show more / less */}
                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="block text-[9px] font-medium text-muted-foreground hover:text-foreground px-1 w-full text-left transition-colors"
                        onClick={() => setExpandedDay(cell.day)}
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                    {isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="block text-[9px] font-medium text-muted-foreground hover:text-foreground px-1 w-full text-left transition-colors"
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
    </div>
  );
}
