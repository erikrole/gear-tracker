"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { FilterChip } from "@/components/FilterChip";
import { SkeletonTable } from "@/components/Skeleton";
import { Input } from "@/components/ui/input";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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

type CalendarSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  _count: { events: number };
};

type LocationMapping = {
  id: string;
  pattern: string;
  priority: number;
  location: { id: string; name: string };
};

type Location = {
  id: string;
  name: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

/** Format raw ICS DTSTART (e.g. "20260301T120000Z") into a readable date. */
function formatIcsDtstart(raw: string): string {
  const cleaned = raw.replace(/[^0-9TZ]/g, "");
  if (cleaned.length < 8) return raw;
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);
  const year = cleaned.slice(0, 4);
  if (cleaned.length === 8) return `${month}/${day}/${year}`;
  const hour = cleaned.slice(9, 11) || "00";
  const min = cleaned.slice(11, 13) || "00";
  return `${month}/${day}/${year} ${hour}:${min}`;
}

export default function EventsPage() {
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState<{
    parsedEventCount?: number;
    responseSizeBytes?: number;
    fetchUrl?: string;
    httpStatus?: number;
    earliestDtstart?: string;
    latestDtstart?: string;
    firstEvents?: { uid: string; summary: string; dtstart: string }[];
    lastEvents?: { uid: string; summary: string; dtstart: string }[];
    errors?: { uid: string; summary: string; operation: string; reason: string }[];
  } | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [includePast, setIncludePast] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const [mappings, setMappings] = useState<LocationMapping[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (!includePast) params.set("startDate", new Date().toISOString());
      if (includePast) params.set("includePast", "true");
      if (unmappedOnly) params.set("unmapped", "true");
      if (sportFilter) params.set("sportCode", sportFilter);
      const res = await fetch(`/api/calendar-events?${params}`);
      if (res.ok) { const json = await res.json(); setEvents(json.data ?? []); }
    } catch { /* network error */ }
    setLoading(false);
  }, [unmappedOnly, includePast, sportFilter]);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-sources");
      if (res.ok) { const json = await res.json(); setSources(json.data ?? []); }
    } catch { /* network error */ }
  }, []);

  useEffect(() => {
    loadEvents();
    loadSources();
  }, [loadEvents, loadSources]);

  const loadMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/location-mappings");
      if (res.ok) { const json = await res.json(); setMappings(json.data ?? []); }
    } catch { /* network error */ }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) { const json = await res.json(); setLocations(json.data ?? []); }
    } catch { /* network error */ }
  }, []);

  useEffect(() => {
    if (showMappings) { loadMappings(); loadLocations(); }
  }, [showMappings, loadMappings, loadLocations]);

  // Load events for calendar view month
  useEffect(() => {
    if (viewMode !== "calendar") return;
    const startDate = calMonth.toISOString();
    const endDate = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const params = new URLSearchParams({ startDate, endDate, includePast: "true", limit: "200" });
    fetch(`/api/calendar-events?${params}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setCalEvents(json.data); })
      .catch(() => {});
  }, [viewMode, calMonth]);

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

  const calEventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const ev of calEvents) {
      const d = new Date(ev.startsAt).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(ev);
    }
    return map;
  }, [calEvents]);

  function isToday(day: number) {
    const now = new Date();
    return calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth() && day === now.getDate();
  }

  // Group events by date for list view
  const groupedEvents = useMemo(() => {
    const groups: [string, CalendarEvent[]][] = [];
    let lastKey = "";
    for (const ev of events) {
      const key = new Date(ev.startsAt).toDateString();
      if (key !== lastKey) { groups.push([key, []]); lastKey = key; }
      groups[groups.length - 1][1].push(ev);
    }
    return groups;
  }, [events]);

  function calBookingClass(ev: CalendarEvent): string {
    if (ev.isHome === true) return "cal-booking cal-booking-home";
    if (ev.isHome === false) return "cal-booking cal-booking-away";
    return "cal-booking cal-booking-neutral";
  }

  function prevMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); }
  function goCalToday() { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }


  async function handleSync(sourceId: string) {
    setSyncing(sourceId);
    setSyncMessage(null);
    setSyncDiagnostics(null);
    try {
      const res = await fetch(`/api/calendar-sources/${sourceId}/sync`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSyncMessage(`Sync failed: ${json?.error || res.statusText}`);
      } else if (json?.data) {
        const d = json.data;
        const parts = [`Added ${d.added}, updated ${d.updated}`];
        if (d.cancelled > 0) parts.push(`cancelled ${d.cancelled}`);
        if (d.skipped > 0) parts.push(`skipped ${d.skipped} (errors)`);
        if (d.error) parts.push(d.error);
        setSyncMessage(parts.join(", "));
        if (d.diagnostics || d.errors?.length) {
          setSyncDiagnostics({ ...d.diagnostics, errors: d.errors });
        }
      }
    } catch {
      setSyncMessage("Sync failed: network error");
    }
    await loadEvents();
    await loadSources();
    setSyncing(null);
  }

  async function handleToggleEnabled(sourceId: string, enabled: boolean) {
    setTogglingId(sourceId);
    try {
      const res = await fetch(`/api/calendar-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) await loadSources();
    } catch { /* network error */ }
    setTogglingId(null);
  }

  async function handleDeleteSource(sourceId: string) {
    const ok = await confirmDialog({
      title: "Delete calendar source",
      message: "Delete this source and all its events? Bookings linked to these events will be unlinked.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingSourceId(sourceId);
    try {
      const res = await fetch(`/api/calendar-sources/${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        await loadSources();
        await loadEvents();
      }
    } catch { /* network error */ }
    setDeletingSourceId(null);
  }

  async function handleAddMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingMapping(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/location-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: form.get("pattern"),
          locationId: form.get("locationId"),
          priority: parseInt(form.get("priority") as string) || 0,
        })
      });
      if (res.ok) {
        setShowAddMapping(false);
        await loadMappings();
        e.currentTarget.reset();
      } else {
        const json = await res.json().catch(() => ({}));
        toast((json as Record<string, string>).error || "Failed to create mapping", "error");
      }
    } catch { toast("Network error — please try again.", "error"); }
    setAddingMapping(false);
  }

  async function handleDeleteMapping(id: string) {
    const ok = await confirmDialog({
      title: "Delete venue mapping",
      message: "Delete this venue mapping?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingMappingId(id);
    try {
      const res = await fetch(`/api/location-mappings/${id}`, { method: "DELETE" });
      if (res.ok) await loadMappings();
    } catch { toast("Network error — please try again.", "error"); }
    setDeletingMappingId(null);
  }

  async function handleAddSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingSource(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/calendar-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          url: form.get("url")
        })
      });
      if (res.ok) {
        setShowAddSource(false);
        await loadSources();
        e.currentTarget.reset();
      }
    } catch { toast("Network error — please try again.", "error"); }
    setAddingSource(false);
  }

  return (
    <>
      <div className="page-header">
        <h1>Events</h1>
        <div className="flex gap-8">
          <Button variant="outline" onClick={() => setShowMappings(!showMappings)}>
            {showMappings ? "Hide mappings" : "Venue mappings"}
          </Button>
          <Button variant="outline" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Hide sources" : "Manage sources"}
          </Button>
        </div>
      </div>

      {/* Sync result message */}
      {syncMessage && (
        <div className="mb-12 text-sm rounded" style={{ padding: "8px 12px", background: syncMessage.includes("failed") ? "var(--bg-warning, #fef9c3)" : "var(--bg-info, #eff6ff)", color: syncMessage.includes("failed") ? "var(--text-warning, #92400e)" : "var(--text-info, #1e40af)" }}>
          {syncMessage}
          <button type="button" onClick={() => { setSyncMessage(null); setSyncDiagnostics(null); }} className="ml-8" style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>&times;</button>
        </div>
      )}

      {/* Sync diagnostics panel */}
      {syncDiagnostics && (
        <details className="mb-12 rounded text-sm" style={{ border: "1px solid var(--border-light)", fontSize: "var(--text-xs)" }}>
          <summary className="p-12 cursor-pointer font-semibold">
            Sync Diagnostics — {syncDiagnostics.parsedEventCount ?? 0} events parsed, {((syncDiagnostics.responseSizeBytes ?? 0) / 1024).toFixed(1)} KB fetched
          </summary>
          <div className="p-12" style={{ display: "grid", gap: 8 }}>
            <div><strong>Fetch URL:</strong> <code className="text-xs" style={{ wordBreak: "break-all" }}>{syncDiagnostics.fetchUrl}</code></div>
            <div><strong>HTTP Status:</strong> {syncDiagnostics.httpStatus}</div>
            <div><strong>Response Size:</strong> {((syncDiagnostics.responseSizeBytes ?? 0) / 1024).toFixed(1)} KB</div>
            <div><strong>Parsed VEVENTs:</strong> {syncDiagnostics.parsedEventCount}</div>
            <div><strong>Date Range:</strong> {syncDiagnostics.earliestDtstart ? formatIcsDtstart(syncDiagnostics.earliestDtstart) : "—"} → {syncDiagnostics.latestDtstart ? formatIcsDtstart(syncDiagnostics.latestDtstart) : "—"}</div>

            {(syncDiagnostics.firstEvents?.length ?? 0) > 0 && (
              <div>
                <strong>First {syncDiagnostics.firstEvents!.length} events (by DTSTART):</strong>
                <table className="w-full mt-4 text-xs">
                  <thead><tr><th className="text-left">UID</th><th className="text-left">Summary</th><th className="text-left">DTSTART</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.firstEvents!.map((e: { uid: string; summary: string; dtstart: string }) => (
                      <tr key={e.uid}><td className="font-mono">{e.uid.slice(0, 30)}</td><td>{e.summary}</td><td className="font-mono" title={e.dtstart}>{formatIcsDtstart(e.dtstart)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(syncDiagnostics.lastEvents?.length ?? 0) > 0 && (
              <div>
                <strong>Last {syncDiagnostics.lastEvents!.length} events (by DTSTART):</strong>
                <table className="w-full mt-4 text-xs">
                  <thead><tr><th className="text-left">UID</th><th className="text-left">Summary</th><th className="text-left">DTSTART</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.lastEvents!.map((e: { uid: string; summary: string; dtstart: string }) => (
                      <tr key={e.uid}><td className="font-mono">{e.uid.slice(0, 30)}</td><td>{e.summary}</td><td className="font-mono" title={e.dtstart}>{formatIcsDtstart(e.dtstart)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(syncDiagnostics.errors?.length ?? 0) > 0 && (
              <div>
                <strong className="text-red">Persistence Errors ({syncDiagnostics.errors!.length} shown):</strong>
                <table className="w-full mt-4 text-xs">
                  <thead><tr><th className="text-left">Op</th><th className="text-left">UID</th><th className="text-left">Summary</th><th className="text-left">Error</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.errors!.map((e: { uid: string; summary: string; operation: string; reason: string }, i: number) => (
                      <tr key={`${e.uid}-${i}`}>
                        <td><span className={`badge ${e.operation === "create" ? "badge-blue" : e.operation === "update" ? "badge-orange" : "badge-gray"}`}>{e.operation}</span></td>
                        <td className="font-mono" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{e.uid.slice(0, 30)}</td>
                        <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{e.summary}</td>
                        <td className="text-red" style={{ wordBreak: "break-word" }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Venue mapping panel */}
      {showMappings && (
        <Card className="mb-16">
          <CardHeader>
            <CardTitle>Venue Mappings</CardTitle>
            <Button size="sm" onClick={() => setShowAddMapping(!showAddMapping)}>
              {showAddMapping ? "Cancel" : "Add mapping"}
            </Button>
          </CardHeader>

          <div className="text-xs text-secondary" style={{ padding: "8px 16px 0" }}>
            Patterns are matched against the combined venue + summary text from calendar events during sync. Supports regex or plain text (case-insensitive).
          </div>

          {showAddMapping && (
            <form onSubmit={handleAddMapping} className="flex flex-wrap gap-8 p-16">
              <Input name="pattern" placeholder="Pattern (regex or text)" required style={{ flex: 2, minWidth: 150 }} />
              <select name="locationId" required className="form-select" style={{ flex: 1, minWidth: 120 }}>
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <Input name="priority" type="number" defaultValue="0" placeholder="Priority" style={{ width: 80 }} title="Higher priority mappings are checked first" />
              <Button type="submit" disabled={addingMapping}>{addingMapping ? "Adding..." : "Add"}</Button>
            </form>
          )}

          {mappings.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">No venue mappings configured. Add patterns to automatically map calendar events to locations.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td className="font-mono text-xs">{m.pattern}</td>
                    <td><span className="badge badge-blue">{m.location.name}</span></td>
                    <td>{m.priority}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteMapping(m.id)}
                        disabled={deletingMappingId === m.id}
                      >
                        {deletingMappingId === m.id ? "..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Sources management panel */}
      {showSources && (
        <Card className="mb-16">
          <CardHeader>
            <CardTitle>Calendar Sources</CardTitle>
            <Button size="sm" onClick={() => setShowAddSource(!showAddSource)}>
              {showAddSource ? "Cancel" : "Add source"}
            </Button>
          </CardHeader>

          {showAddSource && (
            <form onSubmit={handleAddSource} className="flex gap-8 p-16">
              <Input name="name" placeholder="Source name" required className="flex-1" />
              <Input name="url" placeholder="webcal:// or https:// URL" required style={{ flex: 2 }} />
              <Button type="submit" disabled={addingSource}>{addingSource ? "Adding..." : "Add"}</Button>
            </form>
          )}

          {sources.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">No calendar sources configured</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Events</th>
                  <th>Last synced</th>
                  <th>Status</th>
                  <th>Enabled</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} style={source.enabled ? {} : { opacity: 0.6 }}>
                    <td className="font-semibold">{source.name}</td>
                    <td>{source._count.events}</td>
                    <td>
                      {source.lastFetchedAt ? (
                        <span title={new Date(source.lastFetchedAt).toLocaleString()}>
                          {formatDate(source.lastFetchedAt)}
                        </span>
                      ) : "Never"}
                    </td>
                    <td>
                      {source.lastError ? (
                        <span className="badge badge-red cursor-pointer" title={source.lastError}>error</span>
                      ) : source.enabled ? (
                        source.lastFetchedAt && (Date.now() - new Date(source.lastFetchedAt).getTime()) > 24 * 60 * 60 * 1000 ? (
                          <span className="badge badge-orange cursor-pointer" title={`Last synced ${formatDate(source.lastFetchedAt)}`}>stale</span>
                        ) : (
                          <span className="badge badge-green">active</span>
                        )
                      ) : (
                        <span className="badge badge-gray">disabled</span>
                      )}
                      {source.lastError && (
                        <div className="text-xs text-red mt-2 truncate" style={{ maxWidth: 200 }} title={source.lastError}>
                          {source.lastError}
                        </div>
                      )}
                    </td>
                    <td>
                      <Button
                        variant={source.enabled ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggleEnabled(source.id, !source.enabled)}
                        disabled={togglingId === source.id}
                        title={source.enabled ? "Disable this source (sync will skip it)" : "Enable this source"}
                      >
                        {togglingId === source.id ? "..." : source.enabled ? "Disable" : "Enable"}
                      </Button>
                    </td>
                    <td className="flex gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(source.id)}
                        disabled={syncing === source.id || !source.enabled}
                        title={!source.enabled ? "Enable source before syncing" : ""}
                      >
                        {syncing === source.id ? "Syncing..." : "Sync now"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteSource(source.id)}
                        disabled={deletingSourceId === source.id}
                      >
                        {deletingSourceId === source.id ? "..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Filters and view toggle */}
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
        {viewMode === "list" && (
          <div className="filter-chips">
            <FilterChip
              label="Mapping"
              value={unmappedOnly ? "unmapped" : ""}
              displayValue="Unmapped only"
              options={[{ value: "unmapped", label: "Unmapped only" }]}
              onSelect={() => setUnmappedOnly(true)}
              onClear={() => setUnmappedOnly(false)}
            />
            <FilterChip
              label="Time"
              value={includePast ? "all" : ""}
              displayValue="All events"
              options={[{ value: "all", label: "Include past events" }]}
              onSelect={() => setIncludePast(true)}
              onClear={() => setIncludePast(false)}
            />
            <FilterChip
              label="Sport"
              value={sportFilter}
              displayValue={sportFilter ? sportLabel(sportFilter) : ""}
              options={SPORT_CODES.map((s) => ({ value: s.code, label: s.label }))}
              onSelect={(v) => setSportFilter(v)}
              onClear={() => setSportFilter("")}
            />
            {(unmappedOnly || includePast || sportFilter) && (
              <button type="button" className="filter-chip-clear-all" onClick={() => { setUnmappedOnly(false); setIncludePast(false); setSportFilter(""); }}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <Card className="mb-16">
          <CardHeader className="flex-between">
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
              {calCells.map((cell, i) => {
                const dayEvents = cell.day ? calEventsByDay.get(cell.day) : undefined;
                const isExpanded = expandedDay === cell.day;
                const visibleEvents = isExpanded ? dayEvents : dayEvents?.slice(0, 3);
                const hiddenCount = (dayEvents?.length ?? 0) - 3;
                return (
                  <div key={i} className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""} ${isExpanded ? "cal-cell-expanded" : ""}`}>
                    {cell.day && (
                      <>
                        <span className="cal-day-num">{cell.day}</span>
                        {visibleEvents?.map((ev) => (
                          <Link
                            key={ev.id}
                            href={`/events/${ev.id}`}
                            className={calBookingClass(ev)}
                            title={ev.summary}
                          >
                            {ev.sportCode && ev.opponent
                              ? `${ev.sportCode} ${ev.isHome === true ? "vs" : ev.isHome === false ? "at" : "vs"} ${ev.opponent}`
                              : ev.summary}
                          </Link>
                        ))}
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

      {/* Events list */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>{includePast ? "All" : "Upcoming"} Events ({events.length})</CardTitle>
          </CardHeader>

          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : events.length === 0 ? (
            <div className="py-10 px-5 text-center text-muted-foreground">No events found. Add a calendar source and sync.</div>
          ) : (
            <div className="event-list-grouped">
              {groupedEvents.map(([dateKey, groupEvents]) => {
                const isGroupToday = new Date(dateKey).toDateString() === new Date().toDateString();
                return (
                  <div key={dateKey}>
                    <div className={`event-date-header ${isGroupToday ? "event-date-header-today" : ""}`}>
                      {formatDate(groupEvents[0].startsAt)}
                      <span className="event-date-count">{groupEvents.length} event{groupEvents.length !== 1 ? "s" : ""}</span>
                    </div>
                    <table className="data-table data-table-grouped">
                      <thead>
                        <tr>
                          <th>Sport</th>
                          <th>Event</th>
                          <th>Time</th>
                          <th>Location</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupEvents.map((event) => (
                          <tr key={event.id}>
                            <td>
                              {event.sportCode ? (
                                <span className="badge badge-sm badge-purple" title={sportLabel(event.sportCode)}>{event.sportCode}</span>
                              ) : null}
                            </td>
                            <td className="font-semibold">
                              <Link href={`/events/${event.id}`} className="row-link">
                                {event.opponent ? (
                                  <>
                                    {event.isHome === true ? "vs " : event.isHome === false ? "at " : ""}
                                    {event.opponent}
                                  </>
                                ) : (
                                  event.summary
                                )}
                              </Link>
                            </td>
                            <td>{event.allDay ? "All day" : `${formatTime(event.startsAt)} - ${formatTime(event.endsAt)}`}</td>
                            <td>
                              {event.location ? (
                                <span className="badge badge-blue">{event.location.name}</span>
                              ) : event.rawLocationText ? (
                                <span className="text-secondary text-xs">{event.rawLocationText}</span>
                              ) : (
                                <span className="badge badge-orange">needs mapping</span>
                              )}
                            </td>
                            <td className="text-xs text-secondary">
                              {event.source?.name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
