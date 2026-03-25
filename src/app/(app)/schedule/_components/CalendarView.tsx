import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { sportLabel } from "@/lib/sports";
import type { CalendarEntry } from "./types";
import { coverageDot } from "./types";

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

function calBookingClass(entry: CalendarEntry): string {
  if (entry.isHome === true) return "cal-booking cal-booking-home";
  if (entry.isHome === false) return "cal-booking cal-booking-away";
  return "cal-booking cal-booking-neutral";
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

  return (
    <Card className="mb-1">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            &lsaquo;
          </Button>
          <CardTitle className="text-center" style={{ minWidth: 160 }}>
            {calMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            {"\u203a"}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goCalToday}>
          Today
        </Button>
      </CardHeader>
      <div className="p-4">
        <div className="cal-mobile-notice hidden">
          Switch to List view for the best mobile experience.
        </div>
        <div className="cal-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="cal-header">
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
            return (
              <div
                key={i}
                className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(calMonth, cell.day) ? "cal-cell-today" : ""} ${isExpanded ? "cal-cell-expanded" : ""}`}
              >
                {cell.day && (
                  <>
                    <span className="cal-day-num">{cell.day}</span>
                    {visibleEntries?.map((entry) =>
                      entry.shiftGroupId ? (
                        <button
                          key={entry.id}
                          className={`${calBookingClass(entry)} flex items-center gap-1 bg-transparent border-none cursor-pointer w-full text-left px-1 py-0.5`}
                          title={`${entry.summary}${entry.coverage ? ` (${entry.coverage.filled}/${entry.coverage.total} filled)` : ""}`}
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
                              ? `${sportLabel(entry.sportCode)} ${entry.isHome ? "vs" : "at"} ${entry.opponent}`
                              : entry.summary}
                          </span>
                        </button>
                      ) : (
                        <Link
                          key={entry.id}
                          href={`/events/${entry.id}`}
                          className={calBookingClass(entry)}
                          title={entry.summary}
                        >
                          {entry.sportCode && entry.opponent
                            ? `${sportLabel(entry.sportCode)} ${entry.isHome ? "vs" : "at"} ${entry.opponent}`
                            : entry.summary}
                        </Link>
                      ),
                    )}
                    {!isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="cal-more"
                        onClick={() => setExpandedDay(cell.day)}
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                    {isExpanded && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="cal-more"
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
