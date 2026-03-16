"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
const ShiftDetailPanel = dynamic(() => import("@/components/ShiftDetailPanel"), { ssr: false });
import DataList from "@/components/DataList";

type CalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: string;
  rawSummary: string | null;
  rawLocationText: string | null;
  rawDescription: string | null;
  location: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
};

type ShiftGroupSummary = {
  id: string;
  isPremier: boolean;
  shifts: Array<{
    id: string;
    area: string;
    workerType: string;
    assignments: Array<{
      id: string;
      status: string;
      user: { id: string; name: string };
    }>;
  }>;
};

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

const WORKER_LABELS: Record<string, string> = {
  FT: "FT",
  ST: "ST",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [shiftGroup, setShiftGroup] = useState<ShiftGroupSummary | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("STUDENT");

  useEffect(() => {
    fetch(`/api/calendar-events/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => { if (json?.data) setEvent(json.data); else setFetchError(true); })
      .catch(() => setFetchError(true));
  }, [id]);

  const loadShiftGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/shift-groups?startDate=2000-01-01&endDate=2100-01-01`);
      if (res.ok) {
        const json = await res.json();
        const group = (json.data ?? []).find((g: { eventId: string }) => g.eventId === id);
        if (group) setShiftGroup(group);
      }
    } catch { /* network error */ }
  }, [id]);

  useEffect(() => {
    loadShiftGroup();
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.user) {
          setCurrentUserId(j.user.id);
          setCurrentUserRole(j.user.role);
        }
      })
      .catch(() => {});
  }, [loadShiftGroup]);

  if (fetchError) {
    return <div className="empty-state">Event not found or failed to load. <Link href="/events">Back to events</Link></div>;
  }

  if (!event) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const dateParam = encodeURIComponent(event.startsAt);
  const endParam = encodeURIComponent(event.endsAt);
  const titleParam = encodeURIComponent(event.summary);
  const locationParam = event.location?.id ? `&locationId=${event.location.id}` : "";

  return (
    <>
      <div className="breadcrumb">
        <Link href="/events">Events</Link> <span>&rsaquo;</span> {event.summary}
      </div>

      <div className="page-header" style={{ marginBottom: 8 }}>
        <h1>{event.summary}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <span className={`badge ${event.status === "CANCELLED" ? "badge-red" : "badge-green"}`}>
          {event.status.toLowerCase()}
        </span>
        {event.location ? (
          <span className="badge badge-blue">{event.location.name}</span>
        ) : (
          <span className="badge badge-orange">needs location mapping</span>
        )}
        {event.source && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            via {event.source.name}
          </span>
        )}
      </div>

      {/* Action CTAs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <a
          href={`/reservations?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`}
          className="btn btn-primary"
          style={{ textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center", padding: "10px 20px" }}
        >
          Reserve gear for this event
        </a>
        <a
          href={`/checkouts?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`}
          className="btn"
          style={{ textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center", padding: "10px 20px" }}
        >
          Checkout to this event
        </a>
      </div>

      {/* Event details */}
      <div className="card">
        <div className="card-header"><h2>Details</h2></div>
        <div style={{ padding: 16 }}>
          <DataList
            items={[
              {
                label: "When",
                value: event.allDay
                  ? formatDate(event.startsAt)
                  : `${formatDateTime(event.startsAt)} — ${formatDateTime(event.endsAt)}`
              },
              ...(event.rawLocationText
                ? [{ label: "Venue", value: event.rawLocationText }]
                : []),
              ...(event.description
                ? [{ label: "Description", value: <span style={{ whiteSpace: "pre-wrap" }}>{event.description}</span> }]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Shift coverage */}
      {shiftGroup && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header flex-between">
            <h2>Shift Coverage</h2>
            <button className="btn btn-sm" onClick={() => setSelectedGroupId(shiftGroup.id)}>
              Manage shifts
            </button>
          </div>
          <div style={{ padding: 16 }}>
            {shiftGroup.isPremier && (
              <div className="mb-8">
                <span className="badge badge-blue">Premier Event</span>
                <span className="text-xs text-secondary ml-4">Students can request shifts</span>
              </div>
            )}
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Type</th>
                  <th>Assigned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shiftGroup.shifts.map((shift) => {
                  const activeAssignment = shift.assignments.find(
                    (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
                  );
                  const pendingCount = shift.assignments.filter((a) => a.status === "REQUESTED").length;
                  return (
                    <tr key={shift.id}>
                      <td>{AREA_LABELS[shift.area] ?? shift.area}</td>
                      <td>{WORKER_LABELS[shift.workerType] ?? shift.workerType}</td>
                      <td>{activeAssignment ? activeAssignment.user.name : <span className="text-secondary">—</span>}</td>
                      <td>
                        {activeAssignment ? (
                          <span className="badge badge-green">Filled</span>
                        ) : pendingCount > 0 ? (
                          <span className="badge badge-orange">{pendingCount} request{pendingCount > 1 ? "s" : ""}</span>
                        ) : (
                          <span className="badge badge-red">Open</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shift detail panel */}
      {selectedGroupId && (
        <ShiftDetailPanel
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onUpdated={loadShiftGroup}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}

      {/* Debug info for admins */}
      <details style={{ marginTop: 16, fontSize: 12, color: "var(--text-secondary)" }}>
        <summary style={{ cursor: "pointer" }}>Raw ICS data</summary>
        <pre style={{ background: "var(--bg-secondary, #f3f4f6)", padding: 12, borderRadius: 8, marginTop: 8, overflow: "auto" }}>
          {JSON.stringify({ rawSummary: event.rawSummary, rawLocationText: event.rawLocationText, rawDescription: event.rawDescription }, null, 2)}
        </pre>
      </details>
    </>
  );
}
