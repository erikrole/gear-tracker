"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const ShiftDetailPanel = dynamic(() => import("@/components/ShiftDetailPanel"), { ssr: false });
const TradeBoard = dynamic(() => import("@/components/TradeBoard"), { ssr: false });
import { FilterChip } from "@/components/FilterChip";
import { SkeletonTable } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { formatDateShort, formatTimeShort } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

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

function coverageVariant(pct: number): BadgeProps["variant"] {
  if (pct >= 100) return "green";
  if (pct > 0) return "orange";
  return "red";
}

function coverageDot(pct: number): string {
  if (pct >= 100) return "var(--badge-green-bg, #22c55e)";
  if (pct > 0) return "var(--badge-orange-bg, #f59e0b)";
  return "var(--badge-red-bg, #ef4444)";
}

const ACTIVE_STATUSES = ["DIRECT_ASSIGNED", "APPROVED"];

/** Count filled / total for a specific area across shifts (only active assignments) */
function areaCoverage(shifts: Shift[], area: string) {
  const areaShifts = shifts.filter((s) => s.area === area);
  const activeAssignments = areaShifts.flatMap((s) =>
    s.assignments.filter((a) => ACTIVE_STATUSES.includes(a.status))
  );
  return {
    filled: activeAssignments.length,
    total: areaShifts.length,
    assignedUsers: activeAssignments.map((a) => a.user),
  };
}

export default function SchedulePage() {
  const [groups, setGroups] = useState<ShiftGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Page tab
  const [pageTab, setPageTab] = useState<"schedule" | "trades">("schedule");

  // Detail panel
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("STUDENT");

  // Filters
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.user) {
          setCurrentUserId(j.user.id);
          setCurrentUserRole(j.user.role);
        }
      })
      .catch(() => {});
  }, []);

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
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
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
        <div className="flex gap-4 rounded" style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
          <Button
            variant={pageTab === "schedule" ? "default" : "outline"}
            size="sm"
            onClick={() => setPageTab("schedule")}
            style={{ borderRadius: 0, border: "none" }}
          >
            Shifts
          </Button>
          <Button
            variant={pageTab === "trades" ? "default" : "outline"}
            size="sm"
            onClick={() => setPageTab("trades")}
            style={{ borderRadius: 0, border: "none" }}
          >
            Trade Board
          </Button>
        </div>
      </div>

      {pageTab === "trades" ? (
        <TradeBoard currentUserId={currentUserId} currentUserRole={currentUserRole} />
      ) : (
      <>

      {/* View toggle + filters */}
      <div className="filter-chip-bar mb-16">
        <div className="flex gap-4 rounded" style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            style={{ borderRadius: 0, border: "none" }}
          >
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            style={{ borderRadius: 0, border: "none" }}
          >
            Calendar
          </Button>
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
        <Card className="mb-16">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex-center gap-8">
              <Button variant="outline" size="sm" onClick={prevMonth}>&lsaquo;</Button>
              <CardTitle className="text-center" style={{ minWidth: 160 }}>
                {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={nextMonth}>{"\u203a"}</Button>
            </div>
            <Button variant="outline" size="sm" onClick={goCalToday}>Today</Button>
          </CardHeader>
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
                        <button
                          key={g.id}
                          className="cal-booking cal-booking-co"
                          title={`${g.event.summary} (${g.coverage.filled}/${g.coverage.total} filled)`}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "2px 4px" }}
                          onClick={() => setSelectedGroupId(g.id)}
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
                        </button>
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
        </Card>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Shifts ({filteredGroups.length})</CardTitle>
          </CardHeader>

          {loading ? (
            <SkeletonTable rows={6} cols={7} />
          ) : loadError ? (
            <div className="p-16 text-center">
              <p className="text-secondary mb-8">Failed to load shifts.</p>
              <Button variant="outline" size="sm" onClick={loadGroups}>Retry</Button>
            </div>
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
                    <tr key={g.id} onClick={() => setSelectedGroupId(g.id)} style={{ cursor: "pointer" }}>
                      <td className="font-semibold">
                        <span className="row-link" onClick={(e) => { e.stopPropagation(); setSelectedGroupId(g.id); }}>
                          {g.event.summary}
                        </span>
                        {g.isPremier && (
                          <Badge variant="blue" size="sm" className="ml-4">Premier</Badge>
                        )}
                      </td>
                      <td className="text-nowrap">
                        <div>{formatDateShort(g.event.startsAt)}</div>
                        <div className="text-xs text-secondary">{formatTimeShort(g.event.startsAt)}</div>
                      </td>
                      <td>
                        {g.event.sportCode && (
                          <Badge variant="gray">{g.event.sportCode}</Badge>
                        )}
                      </td>
                      {AREAS.map((area) => {
                        const ac = areaCoverage(g.shifts, area);
                        if (ac.total === 0) return <td key={area} className="text-center text-secondary">—</td>;
                        return (
                          <td key={area} className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant={coverageVariant(ac.total > 0 ? (ac.filled / ac.total) * 100 : 0)}>
                                {ac.filled}/{ac.total}
                              </Badge>
                              {ac.assignedUsers.length > 0 && (
                                <AvatarGroup max={3}>
                                  {ac.assignedUsers.map((u) => (
                                    <Avatar key={u.id} className="size-6" title={u.name}>
                                      <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-medium">
                                        {u.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                </AvatarGroup>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center">
                        <Badge variant={coverageVariant(g.coverage.percentage)}>
                          {g.coverage.percentage}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="schedule-mobile-list">
                {filteredGroups.map((g) => (
                  <div key={g.id} className="schedule-mobile-card" onClick={() => setSelectedGroupId(g.id)} style={{ cursor: "pointer" }}>
                    <div className="flex-between mb-4">
                      <span className="font-semibold">{g.event.summary}</span>
                      <Badge variant={coverageVariant(g.coverage.percentage)}>
                        {g.coverage.filled}/{g.coverage.total}
                      </Badge>
                    </div>
                    <div className="text-xs text-secondary flex gap-8">
                      <span>{formatDateShort(g.event.startsAt)} {formatTimeShort(g.event.startsAt)}</span>
                      {g.event.sportCode && <Badge variant="gray">{g.event.sportCode}</Badge>}
                      {g.isPremier && <Badge variant="blue">Premier</Badge>}
                    </div>
                    <div className="flex gap-8 mt-4">
                      {AREAS.map((area) => {
                        const ac = areaCoverage(g.shifts, area);
                        if (ac.total === 0) return null;
                        return (
                          <span key={area} className="text-xs">
                            {AREA_LABELS[area]}: <Badge variant={coverageVariant(ac.total > 0 ? (ac.filled / ac.total) * 100 : 0)} size="sm">{ac.filled}/{ac.total}</Badge>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Shift detail panel */}
      {selectedGroupId && (
        <ShiftDetailPanel
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onUpdated={loadGroups}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}
      </>
      )}
    </>
  );
}
