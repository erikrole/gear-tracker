"use client";

import Link from "next/link";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

/* ───── Types ───── */

type CalendarEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: string;
  rawLocationText: string | null;
  sportCode: string | null;
  opponent: string | null;
  isHome: boolean | null;
  location: { id: string; name: string } | null;
  source: { name: string } | null;
};

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

type ShiftGroup = {
  id: string;
  eventId: string;
  isPremier: boolean;
  notes: string | null;
  event: { id: string; startsAt: string };
  shifts: Shift[];
  coverage: { total: number; filled: number; percentage: number };
};

/** Merged entry for display */
type CalendarEntry = CalendarEvent & {
  shiftGroupId: string | null;
  coverage: { total: number; filled: number; percentage: number } | null;
  shifts: Shift[];
  isPremier: boolean;
};

/* ───── Constants & helpers ───── */

const AREAS = ["VIDEO", "PHOTO", "GRAPHICS", "COMMS"] as const;
const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

const ACTIVE_STATUSES = ["DIRECT_ASSIGNED", "APPROVED"];

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ───── Component ───── */

export default function SchedulePage() {
  // Data
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // View
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [pageTab, setPageTab] = useState<"calendar" | "trades">("calendar");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Filters
  const [sportFilter, setSportFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("");
  const [includePast, setIncludePast] = useState(false);

  // Detail panel
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("STUDENT");

  // Fetch user info
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.user) {
          setCurrentUserId(j.user.id);
          setCurrentUserRole(j.user.role);
        }
      })
      .catch(() => {});
  }, []);

  // Merge events + shift groups into CalendarEntry[]
  const mergeData = useCallback(
    (events: CalendarEvent[], groups: ShiftGroup[]): CalendarEntry[] => {
      const groupByEventId = new Map<string, ShiftGroup>();
      for (const g of groups) groupByEventId.set(g.eventId, g);

      return events.map((ev) => {
        const g = groupByEventId.get(ev.id);
        return {
          ...ev,
          shiftGroupId: g?.id ?? null,
          coverage: g?.coverage ?? null,
          shifts: g?.shifts ?? [],
          isPremier: g?.isPremier ?? false,
        };
      });
    },
    []
  );

  // Load data — fetch both APIs in parallel
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const evParams = new URLSearchParams({ limit: "200" });
      const sgParams = new URLSearchParams();

      if (viewMode === "calendar") {
        const startDate = calMonth.toISOString();
        const endDate = new Date(
          calMonth.getFullYear(),
          calMonth.getMonth() + 1,
          0,
          23, 59, 59
        ).toISOString();
        evParams.set("startDate", startDate);
        evParams.set("endDate", endDate);
        evParams.set("includePast", "true");
        sgParams.set("startDate", startDate);
        sgParams.set("endDate", endDate);
      } else {
        if (!includePast) {
          const now = new Date().toISOString();
          evParams.set("startDate", now);
          sgParams.set("startDate", now);
        } else {
          evParams.set("includePast", "true");
        }
      }

      if (sportFilter) {
        evParams.set("sportCode", sportFilter);
        sgParams.set("sportCode", sportFilter);
      }

      const [evRes, sgRes] = await Promise.all([
        fetch(`/api/calendar-events?${evParams}`),
        fetch(`/api/shift-groups?${sgParams}`),
      ]);

      if (!evRes.ok) throw new Error("events fetch failed");

      const evJson = await evRes.json();
      const events: CalendarEvent[] = evJson.data ?? [];

      // shift-groups may 403 for students without shift:view — that's ok
      let groups: ShiftGroup[] = [];
      if (sgRes.ok) {
        const sgJson = await sgRes.json();
        groups = sgJson.data ?? [];
      }

      setEntries(mergeData(events, groups));
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [viewMode, calMonth, includePast, sportFilter, mergeData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering for area and coverage
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (areaFilter) {
      result = result.filter((e) => e.shifts.some((s) => s.area === areaFilter));
    }
    if (coverageFilter === "unfilled") {
      result = result.filter((e) => !e.coverage || e.coverage.percentage < 100);
    } else if (coverageFilter === "filled") {
      result = result.filter((e) => e.coverage && e.coverage.percentage >= 100);
    }
    return result;
  }, [entries, areaFilter, coverageFilter]);

  // Group entries by date for list view
  const groupedEntries = useMemo(() => {
    const groups: [string, CalendarEntry[]][] = [];
    let lastKey = "";
    for (const entry of filteredEntries) {
      const key = new Date(entry.startsAt).toDateString();
      if (key !== lastKey) {
        groups.push([key, []]);
        lastKey = key;
      }
      groups[groups.length - 1][1].push(entry);
    }
    return groups;
  }, [filteredEntries]);

  // Calendar grid
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

  function isToday(day: number) {
    const now = new Date();
    return (
      calMonth.getFullYear() === now.getFullYear() &&
      calMonth.getMonth() === now.getMonth() &&
      day === now.getDate()
    );
  }

  function prevMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
  }
  function goCalToday() {
    const d = new Date();
    setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function calBookingClass(entry: CalendarEntry): string {
    if (entry.isHome === true) return "cal-booking cal-booking-home";
    if (entry.isHome === false) return "cal-booking cal-booking-away";
    return "cal-booking cal-booking-neutral";
  }

  // Sport options from loaded data
  const sportOptions = useMemo(() => {
    const codes = new Set(
      entries.map((e) => e.sportCode).filter(Boolean) as string[]
    );
    return SPORT_CODES.filter((s) => codes.has(s.code)).map((s) => ({
      value: s.code,
      label: s.label,
    }));
  }, [entries]);

  const hasFilters = !!(sportFilter || areaFilter || coverageFilter || includePast);

  return (
    <>
      <div className="page-header">
        <h1>Schedule</h1>
        <div
          className="flex gap-1 rounded"
          style={{ border: "1px solid var(--border)", overflow: "hidden" }}
        >
          <Button
            variant={pageTab === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setPageTab("calendar")}
            style={{ borderRadius: 0, border: "none" }}
          >
            Events
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
        <TradeBoard
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      ) : (
        <>
          {/* View toggle + filters */}
          <div className="filter-chip-bar mb-1">
            <div
              className="flex gap-1 rounded"
              style={{ border: "1px solid var(--border)", overflow: "hidden" }}
            >
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
                displayValue={
                  areaFilter ? (AREA_LABELS[areaFilter] ?? areaFilter) : ""
                }
                options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
                onSelect={(v) => setAreaFilter(v)}
                onClear={() => setAreaFilter("")}
              />
              <FilterChip
                label="Coverage"
                value={coverageFilter}
                displayValue={
                  coverageFilter === "unfilled"
                    ? "Needs staff"
                    : coverageFilter === "filled"
                      ? "Fully staffed"
                      : ""
                }
                options={[
                  { value: "unfilled", label: "Needs staff" },
                  { value: "filled", label: "Fully staffed" },
                ]}
                onSelect={(v) => setCoverageFilter(v)}
                onClear={() => setCoverageFilter("")}
              />
              {viewMode === "list" && (
                <FilterChip
                  label="Time"
                  value={includePast ? "all" : ""}
                  displayValue="All events"
                  options={[{ value: "all", label: "Include past events" }]}
                  onSelect={() => setIncludePast(true)}
                  onClear={() => setIncludePast(false)}
                />
              )}
              {hasFilters && (
                <button
                  type="button"
                  className="filter-chip-clear-all"
                  onClick={() => {
                    setSportFilter("");
                    setAreaFilter("");
                    setCoverageFilter("");
                    setIncludePast(false);
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* ── Calendar View ── */}
          {viewMode === "calendar" && (
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
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div key={d} className="cal-header">
                        {d}
                      </div>
                    )
                  )}
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
                        className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""} ${isExpanded ? "cal-cell-expanded" : ""}`}
                      >
                        {cell.day && (
                          <>
                            <span className="cal-day-num">{cell.day}</span>
                            {visibleEntries?.map((entry) =>
                              entry.shiftGroupId ? (
                                <button
                                  key={entry.id}
                                  className={calBookingClass(entry)}
                                  title={`${entry.summary}${entry.coverage ? ` (${entry.coverage.filled}/${entry.coverage.total} filled)` : ""}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "2px 4px",
                                  }}
                                  onClick={() =>
                                    setSelectedGroupId(entry.shiftGroupId)
                                  }
                                >
                                  {entry.coverage && (
                                    <span
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: coverageDot(
                                          entry.coverage.percentage
                                        ),
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {entry.sportCode && entry.opponent
                                      ? `${entry.sportCode} ${entry.isHome ? "vs" : "at"} ${entry.opponent}`
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
                                    ? `${entry.sportCode} ${entry.isHome ? "vs" : "at"} ${entry.opponent}`
                                    : entry.summary}
                                </Link>
                              )
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
          )}

          {/* ── List View ── */}
          {viewMode === "list" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {includePast ? "All" : "Upcoming"} Events (
                  {filteredEntries.length})
                </CardTitle>
              </CardHeader>

              {loading ? (
                <SkeletonTable rows={6} cols={6} />
              ) : loadError ? (
                <div className="p-4 text-center">
                  <p className="text-secondary mb-2">
                    Failed to load calendar data.
                  </p>
                  <Button variant="outline" size="sm" onClick={loadData}>
                    Retry
                  </Button>
                </div>
              ) : filteredEntries.length === 0 ? (
                <EmptyState
                  icon="calendar"
                  title="No events found"
                  description={
                    hasFilters
                      ? "Try adjusting your filters."
                      : "No upcoming events. Check Settings → Calendar Sources to add an ICS feed."
                  }
                  actionLabel={hasFilters ? undefined : "Calendar Sources"}
                  actionHref={hasFilters ? undefined : "/settings/calendar-sources"}
                />
              ) : (
                <>
                  {/* Desktop: date-grouped table */}
                  <div className="event-list-grouped schedule-table-desktop">
                    {groupedEntries.map(([dateKey, groupEntries]) => {
                      const isGroupToday =
                        new Date(dateKey).toDateString() ===
                        new Date().toDateString();
                      return (
                        <div key={dateKey}>
                          <div
                            className={`event-date-header ${isGroupToday ? "event-date-header-today" : ""}`}
                          >
                            {formatDate(groupEntries[0].startsAt)}
                            <span className="event-date-count">
                              {groupEntries.length} event
                              {groupEntries.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <table className="data-table data-table-grouped">
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
                              {groupEntries.map((entry) => (
                                <tr key={entry.id}>
                                  <td>
                                    {entry.sportCode && (
                                      <Badge
                                        variant="purple"
                                        size="sm"
                                        title={sportLabel(entry.sportCode)}
                                      >
                                        {entry.sportCode}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="font-semibold">
                                    <Link
                                      href={`/events/${entry.id}`}
                                      className="row-link"
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
                                  </td>
                                  <td>
                                    {entry.allDay
                                      ? "All day"
                                      : `${formatTime(entry.startsAt)} – ${formatTime(entry.endsAt)}`}
                                  </td>
                                  <td>
                                    {entry.location ? (
                                      <Badge variant="blue">
                                        {entry.location.name}
                                      </Badge>
                                    ) : entry.rawLocationText ? (
                                      <span className="text-secondary text-xs">
                                        {entry.rawLocationText}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="text-center">
                                    {entry.coverage ? (
                                      <Badge
                                        variant={coverageVariant(
                                          entry.coverage.percentage
                                        )}
                                      >
                                        {entry.coverage.filled}/
                                        {entry.coverage.total}
                                      </Badge>
                                    ) : (
                                      <span className="text-secondary">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile cards */}
                  <div className="schedule-mobile-list">
                    {filteredEntries.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/events/${entry.id}`}
                        className="schedule-mobile-card no-underline"
                        style={{ cursor: "pointer", display: "block" }}
                      >
                        <div className="flex-between mb-1">
                          <span className="font-semibold">
                            {entry.opponent
                              ? `${entry.isHome === true ? "vs " : entry.isHome === false ? "at " : ""}${entry.opponent}`
                              : entry.summary}
                          </span>
                          {entry.coverage && (
                            <Badge
                              variant={coverageVariant(
                                entry.coverage.percentage
                              )}
                            >
                              {entry.coverage.filled}/{entry.coverage.total}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-secondary flex gap-2 flex-wrap">
                          <span>
                            {formatDateShort(entry.startsAt)}{" "}
                            {entry.allDay
                              ? "All day"
                              : formatTimeShort(entry.startsAt)}
                          </span>
                          {entry.sportCode && (
                            <Badge variant="gray">{entry.sportCode}</Badge>
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
                                        : 0
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
              onUpdated={loadData}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          )}
        </>
      )}
    </>
  );
}
