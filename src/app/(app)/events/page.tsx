"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  useEffect(() => {
    loadEvents();
    loadSources();
  }, [unmappedOnly]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
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
    await fetch(`/api/calendar-sources/${sourceId}/sync`, { method: "POST" });
    await loadEvents();
    await loadSources();
    setSyncing(null);
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
          <button className="btn" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Hide sources" : "Manage sources"}
          </button>
        </div>
      </div>

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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td style={{ fontWeight: 600 }}>{source.name}</td>
                    <td>{source._count.events}</td>
                    <td>{source.lastFetchedAt ? formatDate(source.lastFetchedAt) : "Never"}</td>
                    <td>
                      {source.lastError ? (
                        <span className="badge badge-red" title={source.lastError}>error</span>
                      ) : source.enabled ? (
                        <span className="badge badge-green">active</span>
                      ) : (
                        <span className="badge badge-gray">disabled</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleSync(source.id)}
                        disabled={syncing === source.id}
                      >
                        {syncing === source.id ? "Syncing..." : "Sync now"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={unmappedOnly}
            onChange={(e) => setUnmappedOnly(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Show only unmapped events
        </label>
      </div>

      {/* Events list */}
      <div className="card">
        <div className="card-header">
          <h2>Upcoming Events ({events.length})</h2>
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
    </>
  );
}
