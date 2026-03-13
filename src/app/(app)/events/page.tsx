"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

type CalendarEvent = {
  id: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: string;
  rawLocationText: string | null;
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

export default function EventsPage() {
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [syncDiagnostics, setSyncDiagnostics] = useState<any>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [includePast, setIncludePast] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const [mappings, setMappings] = useState<LocationMapping[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    loadEvents();
    loadSources();
  }, [unmappedOnly, includePast]);

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

  function prevMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)); }
  function goCalToday() { const d = new Date(); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (!includePast) params.set("startDate", new Date().toISOString());
      if (includePast) params.set("includePast", "true");
      if (unmappedOnly) params.set("unmapped", "true");
      const res = await fetch(`/api/calendar-events?${params}`);
      if (res.ok) { const json = await res.json(); setEvents(json.data ?? []); }
    } catch { /* network error */ }
    setLoading(false);
  }

  async function loadSources() {
    try {
      const res = await fetch("/api/calendar-sources");
      if (res.ok) { const json = await res.json(); setSources(json.data ?? []); }
    } catch { /* network error */ }
  }

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
    try {
      const res = await fetch(`/api/calendar-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) await loadSources();
    } catch { /* network error */ }
  }

  async function handleDeleteSource(sourceId: string) {
    const ok = await confirmDialog({
      title: "Delete calendar source",
      message: "Delete this source and all its events? Bookings linked to these events will be unlinked.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/calendar-sources/${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        await loadSources();
        await loadEvents();
      }
    } catch { /* network error */ }
  }

  async function handleAddMapping(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
  }

  async function handleDeleteMapping(id: string) {
    const ok = await confirmDialog({
      title: "Delete venue mapping",
      message: "Delete this venue mapping?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/location-mappings/${id}`, { method: "DELETE" });
      if (res.ok) await loadMappings();
    } catch { toast("Network error — please try again.", "error"); }
  }

  async function handleAddSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
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
  }

  return (
    <>
      <div className="page-header">
        <h1>Events</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowMappings(!showMappings)}>
            {showMappings ? "Hide mappings" : "Venue mappings"}
          </button>
          <button className="btn" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Hide sources" : "Manage sources"}
          </button>
        </div>
      </div>

      {/* Sync result message */}
      {syncMessage && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: syncMessage.includes("failed") ? "var(--bg-warning, #fef9c3)" : "var(--bg-info, #eff6ff)", color: syncMessage.includes("failed") ? "var(--text-warning, #92400e)" : "var(--text-info, #1e40af)" }}>
          {syncMessage}
          <button type="button" onClick={() => { setSyncMessage(null); setSyncDiagnostics(null); }} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>&times;</button>
        </div>
      )}

      {/* Sync diagnostics panel */}
      {syncDiagnostics && (
        <details style={{ marginBottom: 12, border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 12 }}>
          <summary style={{ padding: "8px 12px", cursor: "pointer", fontWeight: 600 }}>
            Sync Diagnostics — {syncDiagnostics.parsedEventCount} events parsed, {(syncDiagnostics.responseSizeBytes / 1024).toFixed(1)} KB fetched
          </summary>
          <div style={{ padding: "8px 12px", display: "grid", gap: 8 }}>
            <div><strong>Fetch URL:</strong> <code style={{ fontSize: 11, wordBreak: "break-all" }}>{syncDiagnostics.fetchUrl}</code></div>
            <div><strong>HTTP Status:</strong> {syncDiagnostics.httpStatus}</div>
            <div><strong>Response Size:</strong> {(syncDiagnostics.responseSizeBytes / 1024).toFixed(1)} KB</div>
            <div><strong>Parsed VEVENTs:</strong> {syncDiagnostics.parsedEventCount}</div>
            <div><strong>Date Range:</strong> {syncDiagnostics.earliestDtstart ?? "—"} → {syncDiagnostics.latestDtstart ?? "—"}</div>

            {syncDiagnostics.firstEvents?.length > 0 && (
              <div>
                <strong>First {syncDiagnostics.firstEvents.length} events (by DTSTART):</strong>
                <table style={{ width: "100%", marginTop: 4, fontSize: 11 }}>
                  <thead><tr><th style={{ textAlign: "left" }}>UID</th><th style={{ textAlign: "left" }}>Summary</th><th style={{ textAlign: "left" }}>DTSTART</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.firstEvents.map((e: { uid: string; summary: string; dtstart: string }) => (
                      <tr key={e.uid}><td style={{ fontFamily: "monospace" }}>{e.uid.slice(0, 30)}</td><td>{e.summary}</td><td style={{ fontFamily: "monospace" }}>{e.dtstart}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {syncDiagnostics.lastEvents?.length > 0 && (
              <div>
                <strong>Last {syncDiagnostics.lastEvents.length} events (by DTSTART):</strong>
                <table style={{ width: "100%", marginTop: 4, fontSize: 11 }}>
                  <thead><tr><th style={{ textAlign: "left" }}>UID</th><th style={{ textAlign: "left" }}>Summary</th><th style={{ textAlign: "left" }}>DTSTART</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.lastEvents.map((e: { uid: string; summary: string; dtstart: string }) => (
                      <tr key={e.uid}><td style={{ fontFamily: "monospace" }}>{e.uid.slice(0, 30)}</td><td>{e.summary}</td><td style={{ fontFamily: "monospace" }}>{e.dtstart}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {syncDiagnostics.errors?.length > 0 && (
              <div>
                <strong style={{ color: "var(--red, #dc2626)" }}>Persistence Errors ({syncDiagnostics.errors.length} shown):</strong>
                <table style={{ width: "100%", marginTop: 4, fontSize: 11 }}>
                  <thead><tr><th style={{ textAlign: "left" }}>Op</th><th style={{ textAlign: "left" }}>UID</th><th style={{ textAlign: "left" }}>Summary</th><th style={{ textAlign: "left" }}>Error</th></tr></thead>
                  <tbody>
                    {syncDiagnostics.errors.map((e: { uid: string; summary: string; operation: string; reason: string }, i: number) => (
                      <tr key={`${e.uid}-${i}`}>
                        <td><span className={`badge ${e.operation === "create" ? "badge-blue" : e.operation === "update" ? "badge-orange" : "badge-gray"}`}>{e.operation}</span></td>
                        <td style={{ fontFamily: "monospace", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{e.uid.slice(0, 30)}</td>
                        <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{e.summary}</td>
                        <td style={{ color: "var(--red, #dc2626)", wordBreak: "break-word" }}>{e.reason}</td>
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2>Venue Mappings</h2>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddMapping(!showAddMapping)}>
              {showAddMapping ? "Cancel" : "Add mapping"}
            </button>
          </div>

          <div style={{ padding: "8px 16px 0", fontSize: 12, color: "var(--text-secondary)" }}>
            Patterns are matched against the combined venue + summary text from calendar events during sync. Supports regex or plain text (case-insensitive).
          </div>

          {showAddMapping && (
            <form onSubmit={handleAddMapping} style={{ padding: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input name="pattern" placeholder="Pattern (regex or text)" required style={{ flex: 2, minWidth: 150, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
              <select name="locationId" required style={{ flex: 1, minWidth: 120, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}>
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <input name="priority" type="number" defaultValue="0" placeholder="Priority" style={{ width: 80, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} title="Higher priority mappings are checked first" />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
          )}

          {mappings.length === 0 ? (
            <div className="empty-state">No venue mappings configured. Add patterns to automatically map calendar events to locations.</div>
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
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{m.pattern}</td>
                    <td><span className="badge badge-blue">{m.location.name}</span></td>
                    <td>{m.priority}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--red, #dc2626)" }}
                        onClick={() => handleDeleteMapping(m.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sources management panel */}
      {showSources && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2>Calendar Sources</h2>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddSource(!showAddSource)}>
              {showAddSource ? "Cancel" : "Add source"}
            </button>
          </div>

          {showAddSource && (
            <form onSubmit={handleAddSource} style={{ padding: 16, display: "flex", gap: 8 }}>
              <input name="name" placeholder="Source name" required style={{ flex: 1, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
              <input name="url" placeholder="webcal:// or https:// URL" required style={{ flex: 2, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }} />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
          )}

          {sources.length === 0 ? (
            <div className="empty-state">No calendar sources configured</div>
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
                    <td style={{ fontWeight: 600 }}>{source.name}</td>
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
                        <span className="badge badge-red" title={source.lastError} style={{ cursor: "help" }}>error</span>
                      ) : source.enabled ? (
                        source.lastFetchedAt && (Date.now() - new Date(source.lastFetchedAt).getTime()) > 24 * 60 * 60 * 1000 ? (
                          <span className="badge badge-orange" title={`Last synced ${formatDate(source.lastFetchedAt)}`} style={{ cursor: "help" }}>stale</span>
                        ) : (
                          <span className="badge badge-green">active</span>
                        )
                      ) : (
                        <span className="badge badge-gray">disabled</span>
                      )}
                      {source.lastError && (
                        <div style={{ fontSize: 11, color: "var(--red, #dc2626)", marginTop: 2, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={source.lastError}>
                          {source.lastError}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${source.enabled ? "" : "btn-primary"}`}
                        onClick={() => handleToggleEnabled(source.id, !source.enabled)}
                        title={source.enabled ? "Disable this source (sync will skip it)" : "Enable this source"}
                      >
                        {source.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleSync(source.id)}
                        disabled={syncing === source.id || !source.enabled}
                        title={!source.enabled ? "Enable source before syncing" : ""}
                      >
                        {syncing === source.id ? "Syncing..." : "Sync now"}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ color: "var(--red, #dc2626)" }}
                        onClick={() => handleDeleteSource(source.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Filters and view toggle */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
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
        {viewMode === "list" && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={unmappedOnly} onChange={(e) => setUnmappedOnly(e.target.checked)} style={{ width: 16, height: 16 }} />
              Unmapped only
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} style={{ width: 16, height: 16 }} />
              Include past events
            </label>
          </>
        )}
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn btn-sm" onClick={prevMonth}>{"\u2039"}</button>
              <h2 style={{ minWidth: 160, textAlign: "center" }}>
                {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <button className="btn btn-sm" onClick={nextMonth}>{"\u203a"}</button>
            </div>
            <button className="btn btn-sm" onClick={goCalToday}>Today</button>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div className="cal-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="cal-header">{d}</div>
              ))}
              {calCells.map((cell, i) => (
                <div key={i} className={`cal-cell ${cell.day === null ? "cal-cell-empty" : ""} ${cell.day && isToday(cell.day) ? "cal-cell-today" : ""}`}>
                  {cell.day && (
                    <>
                      <span className="cal-day-num">{cell.day}</span>
                      {calEventsByDay.get(cell.day)?.slice(0, 3).map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/events/${ev.id}`}
                          className="cal-booking cal-booking-co"
                          title={ev.summary}
                        >
                          {ev.summary}
                        </Link>
                      ))}
                      {(calEventsByDay.get(cell.day)?.length ?? 0) > 3 && (
                        <span className="cal-more">+{(calEventsByDay.get(cell.day)?.length ?? 0) - 3} more</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {viewMode === "list" && (
        <div className="card">
          <div className="card-header">
            <h2>{includePast ? "All" : "Upcoming"} Events ({events.length})</h2>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : events.length === 0 ? (
            <div className="empty-state">No events found. Add a calendar source and sync.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/events/${event.id}`} className="row-link">
                        {event.summary}
                      </Link>
                    </td>
                    <td>{formatDate(event.startsAt)}</td>
                    <td>{event.allDay ? "All day" : `${formatTime(event.startsAt)} - ${formatTime(event.endsAt)}`}</td>
                    <td>
                      {event.location ? (
                        <span className="badge badge-blue">{event.location.name}</span>
                      ) : (
                        <span className="badge badge-orange">needs mapping</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {event.source?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
