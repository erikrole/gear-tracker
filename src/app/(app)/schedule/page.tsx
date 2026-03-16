"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterChip } from "@/components/FilterChip";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { formatDateShort, formatTimeShort } from "@/lib/format";

/* ───── Types ───── */

type ShiftUser = { id: string; name: string; primaryArea: string | null };

type ShiftAssignment = {
  id: string;
  status: string;
  user: ShiftUser;
};

type Shift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  assignments: ShiftAssignment[];
};

type ShiftGroupEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  sportCode: string | null;
  isHome: boolean | null;
  opponent: string | null;
  locationId: string | null;
};

type ShiftGroup = {
  id: string;
  eventId: string;
  isPremier: boolean;
  notes: string | null;
  event: ShiftGroupEvent;
  shifts: Shift[];
  coverage: { total: number; filled: number; percentage: number };
};

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

function coverageClass(pct: number): string {
  if (pct >= 100) return "badge-green";
  if (pct > 0) return "badge-orange";
  return "badge-red";
}

function coverageDot(pct: number): string {
  if (pct >= 100) return "var(--badge-green-bg, #22c55e)";
  if (pct > 0) return "var(--badge-orange-bg, #f59e0b)";
  return "var(--badge-red-bg, #ef4444)";
}

/** Count filled / total for a specific area across shifts */
function areaCoverage(shifts: Shift[], area: string) {
  const areaShifts = shifts.filter((s) => s.area === area);
  const filled = areaShifts.filter((s) => s.assignments.length > 0).length;
  return { filled, total: areaShifts.length };
}

export default function SchedulePage() {
  const [groups, setGroups] = useState<ShiftGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Filters
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sportFilter) params.set("sportCode", sportFilter);
      // For calendar view, constrain to month
      if (viewMode === "calendar") {
        params.set("startDate", calMonth.toISOString());
        const endOfMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59);
        params.set("endDate", endOfMonth.toISOString());
      } else {
        // List view: upcoming only
        params.set("startDate", new Date().toISOString());
      }
      const res = await fetch(`/api/shift-groups?${params}`);
      if (res.ok) {
        const json = await res.json();
        setGroups(json.data ?? []);
      }
    } catch { /* network error */ }
    setLoading(false);
  }, [sportFilter, viewMode, calMonth]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Filtered groups for list view
  const filteredGroups = useMemo(() => {
    let result = groups;
    if (areaFilter) {
      result = result.filter((g) =>
        g.shifts.some((s) => s.area === areaFilter)
      );
    }
    if (coverageFilter === "unfilled") {
      result = result.filter((g) => g.coverage.percentage < 100);
    } else if (coverageFilter === "filled") {
      result = result.filter((g) => g.coverage.percentage >= 100);
    }
    return result;
  }, [groups, areaFilter, coverageFilter]);

  // Calendar grid computation
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

  const calGroupsByDay = useMemo(() => {
    const map = new Map<number, ShiftGroup[]>();
    for (const g of groups) {
      const d = new Date(g.event.startsAt).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(g);
    }
    return map;
  }, [groups]);

  function isToday(day: number) {
    const now = new Date();
    return calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth() && day === now.getDate();
  }

  function prevMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); }
  function goCalToday() { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }

  const hasFilters = !!(sportFilter || areaFilter || coverageFilter);

  const sportOptions = useMemo(() => {
    const codes = new Set(groups.map((g) => g.event.sportCode).filter(Boolean) as string[]);
    return SPORT_CODES.filter((s) => codes.has(s.code)).map((s) => ({
      value: s.code,
      label: s.label,
    }));
  }, [groups]);

  return (
    <>
      <div className="page-header">
        <h1>Schedule</h1>
      </div>

      {/* View toggle + filters */}
      <div className="filter-chip-bar mb-16">
        <div className="flex gap-4 rounded" style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
          <button
            className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : ""}`}
            onClick={() => setViewMode("list")}
            style={{ borderRadius: 0, border: "none" }}
          >
            List
          </button>
          <button
            className={`btn btn-sm ${viewMode === "calendar" ? "btn-primary" : ""}`}
            onClick={() => setViewMode("calendar")}
            style={{ borderRadius: 0, border: "none" }}
          >
            Calendar
          </button>
        </div>
        <div className="filter-chips">
          <FilterChip
            label="Sport"
            value={sportFilter}
            displayValue={sportFilter ? sportLabel(sportFilter) : ""}
            options={sportOptions}
            onSelect={(v) => setSportFilter(v)}
            onClear={() => setSportFilter("")}
          />
          <FilterChip
            label="Area"
            value={areaFilter}
            displayValue={areaFilter ? AREA_LABELS[areaFilter] ?? areaFilter : ""}
            options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
            onSelect={(v) => setAreaFilter(v)}
            onClear={() => setAreaFilter("")}
          />
          <FilterChip
            label="Coverage"
            value={coverageFilter}
            displayValue={coverageFilter === "unfilled" ? "Needs staff" : coverageFilter === "filled" ? "Fully staffed" : ""}
            options={[
              { value: "unfilled", label: "Needs staff" },
              { value: "filled", label: "Fully staffed" },
            ]}
            onSelect={(v) => setCoverageFilter(v)}
            onClear={() => setCoverageFilter("")}
          />
          {hasFilters && (
            <button
              type="button"
              className="filter-chip-clear-all"
              onClick={() => { setSportFilter(""); setAreaFilter(""); setCoverageFilter(""); }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <div className="card mb-16">
          <div className="card-header flex-between">
            <div className="flex-center gap-8">
              <button className="btn btn-sm" onClick={prevMonth}>&lsaquo;</button>
              <h2 className="text-center" style={{ minWidth: 160 }}>
                {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <button className="btn btn-sm" onClick={nextMonth}>{"\u203a"}</button>
            </div>
            <button className="btn btn-sm" onClick={goCalToday}>Today</button>
          </div>
          <div className="p-16">
            <div className="cal-mobile-notice hidden">
              Switch to List view for the best mobile experience.
            </div>
            <div className="cal-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="cal-header">{d}</div>
              ))}
              {calCells.map((cell, i) => (
                <div key={i} className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""}`}>
                  {cell.day && (
                    <>
                      <span className="cal-day-num">{cell.day}</span>
                      {calGroupsByDay.get(cell.day)?.slice(0, 3).map((g) => (
                        <Link
                          key={g.id}
                          href={`/events/${g.eventId}`}
                          className="cal-booking cal-booking-co"
                          title={`${g.event.summary} (${g.coverage.filled}/${g.coverage.total} filled)`}
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: coverageDot(g.coverage.percentage),
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {g.event.summary}
                          </span>
                        </Link>
                      ))}
                      {(calGroupsByDay.get(cell.day)?.length ?? 0) > 3 && (
                        <span className="cal-more">
                          +{(calGroupsByDay.get(cell.day)?.length ?? 0) - 3} more
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="card">
          <div className="card-header">
            <h2>Upcoming Shifts ({filteredGroups.length})</h2>
          </div>

          {loading ? (
            <SkeletonTable rows={6} cols={7} />
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No shifts found"
              description={hasFilters ? "Try adjusting your filters." : "Shifts are auto-generated when calendar events sync."}
            />
          ) : (
            <>
              {/* Desktop table */}
              <table className="data-table schedule-table-desktop">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Sport</th>
                    {AREAS.map((a) => (
                      <th key={a} className="text-center">{AREA_LABELS[a]}</th>
                    ))}
                    <th className="text-center">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((g) => (
                    <tr key={g.id}>
                      <td className="font-semibold">
                        <Link href={`/events/${g.eventId}`} className="row-link">
                          {g.event.summary}
                        </Link>
                        {g.isPremier && (
                          <span className="badge badge-blue ml-4" style={{ fontSize: 10 }}>Premier</span>
                        )}
                      </td>
                      <td className="text-nowrap">
                        <div>{formatDateShort(g.event.startsAt)}</div>
                        <div className="text-xs text-secondary">{formatTimeShort(g.event.startsAt)}</div>
                      </td>
                      <td>
                        {g.event.sportCode && (
                          <span className="badge badge-gray">{g.event.sportCode}</span>
                        )}
                      </td>
                      {AREAS.map((area) => {
                        const ac = areaCoverage(g.shifts, area);
                        if (ac.total === 0) return <td key={area} className="text-center text-secondary">—</td>;
                        return (
                          <td key={area} className="text-center">
                            <span className={`badge ${coverageClass(ac.total > 0 ? (ac.filled / ac.total) * 100 : 0)}`}>
                              {ac.filled}/{ac.total}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center">
                        <span className={`badge ${coverageClass(g.coverage.percentage)}`}>
                          {g.coverage.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="schedule-mobile-list">
                {filteredGroups.map((g) => (
                  <Link key={g.id} href={`/events/${g.eventId}`} className="schedule-mobile-card">
                    <div className="flex-between mb-4">
                      <span className="font-semibold">{g.event.summary}</span>
                      <span className={`badge ${coverageClass(g.coverage.percentage)}`}>
                        {g.coverage.filled}/{g.coverage.total}
                      </span>
                    </div>
                    <div className="text-xs text-secondary flex gap-8">
                      <span>{formatDateShort(g.event.startsAt)} {formatTimeShort(g.event.startsAt)}</span>
                      {g.event.sportCode && <span className="badge badge-gray">{g.event.sportCode}</span>}
                      {g.isPremier && <span className="badge badge-blue">Premier</span>}
                    </div>
                    <div className="flex gap-8 mt-4">
                      {AREAS.map((area) => {
                        const ac = areaCoverage(g.shifts, area);
                        if (ac.total === 0) return null;
                        return (
                          <span key={area} className="text-xs">
                            {AREA_LABELS[area]}: <span className={`badge ${coverageClass(ac.total > 0 ? (ac.filled / ac.total) * 100 : 0)}`} style={{ fontSize: 10 }}>{ac.filled}/{ac.total}</span>
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
