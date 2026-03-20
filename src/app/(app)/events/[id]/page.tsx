"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
const ShiftDetailPanel = dynamic(() => import("@/components/ShiftDetailPanel"), { ssr: false });
import DataList from "@/components/DataList";
import { sportLabel } from "@/lib/sports";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
  sportCode: string | null;
  opponent: string | null;
  isHome: boolean | null;
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

type CommandCenterData = {
  shifts: Array<{
    id: string;
    area: string;
    workerType: string;
    startsAt: string;
    endsAt: string;
    assignment: { id: string; userId: string; userName: string; status: string; linkedBookingId: string | null; linkedBookingStatus: string | null } | null;
    pendingRequests: number;
  }>;
  gearSummary: {
    total: number;
    byStatus: { draft: number; reserved: number; checkedOut: number; completed: number };
  };
  missingGear: Array<{
    userId: string;
    userName: string;
    area: string;
    shiftId: string;
    assignmentId: string;
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
  const [commandCenter, setCommandCenter] = useState<CommandCenterData | null>(null);
  const [nudgingId, setNudgingId] = useState<string | null>(null);

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

  const loadCommandCenter = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar-events/${id}/command-center`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setCommandCenter(json.data);
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
          // Load command center for staff/admin
          if (j.user.role === "STAFF" || j.user.role === "ADMIN") {
            loadCommandCenter();
          }
        }
      })
      .catch(() => {});
  }, [loadShiftGroup, loadCommandCenter]);

  if (fetchError) {
    return <div className="py-10 px-5 text-center text-muted-foreground">Event not found or failed to load. <Link href="/events">Back to events</Link></div>;
  }

  if (!event) {
    return <div className="flex items-center justify-center py-10"><Spinner className="size-8" /></div>;
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
        {event.sportCode && (
          <span className="badge badge-purple">{sportLabel(event.sportCode)}</span>
        )}
        {event.isHome !== null && (
          <span className={`badge ${event.isHome ? "badge-green" : "badge-orange"}`}>
            {event.isHome ? "Home" : "Away"}
          </span>
        )}
        {event.location ? (
          <span className="badge badge-blue">{event.location.name}</span>
        ) : (
          <span className="badge badge-orange">needs location mapping</span>
        )}
        {event.source && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            via {event.source.name}
          </span>
        )}
      </div>

      {/* Action CTAs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <Button asChild style={{ minHeight: 44, padding: "10px 20px" }}>
          <a href={`/reservations?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`} style={{ textDecoration: "none" }}>
            Reserve gear for this event
          </a>
        </Button>
        <Button variant="outline" asChild style={{ minHeight: 44, padding: "10px 20px" }}>
          <a href={`/checkouts?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`} style={{ textDecoration: "none" }}>
            Checkout to this event
          </a>
        </Button>
      </div>

      {/* Event details */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <div style={{ padding: 16 }}>
          <DataList
            items={[
              ...(event.sportCode
                ? [{ label: "Sport", value: sportLabel(event.sportCode) }]
                : []),
              ...(event.opponent
                ? [{ label: "Opponent", value: event.opponent }]
                : []),
              ...(event.isHome !== null
                ? [{ label: "Home/Away", value: event.isHome ? "Home" : "Away" }]
                : []),
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
      </Card>

      {/* Shift coverage */}
      {shiftGroup && (
        <Card style={{ marginTop: 16 }}>
          <CardHeader className="flex-between">
            <CardTitle>Shift Coverage</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSelectedGroupId(shiftGroup.id)}>
              Manage shifts
            </Button>
          </CardHeader>
          <div style={{ padding: 16 }}>
            {shiftGroup.isPremier && (
              <div className="mb-8">
                <span className="badge badge-blue">Premier Event</span>
                <span className="text-xs text-secondary ml-4">Students can request shifts</span>
              </div>
            )}
            <table className="data-table" style={{ fontSize: "var(--text-sm)" }}>
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
                      <td>
                        {activeAssignment ? (
                          <span className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-medium">
                                {activeAssignment.user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {activeAssignment.user.name}
                          </span>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
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
        </Card>
      )}

      {/* Command Center (staff/admin only) */}
      {commandCenter && commandCenter.shifts.length > 0 && (currentUserRole === "STAFF" || currentUserRole === "ADMIN") && (
        <Card style={{ marginTop: 16 }}>
          <CardHeader>
            <CardTitle>Command Center</CardTitle>
          </CardHeader>
          <div style={{ padding: 16 }}>
            {/* Gear status pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span className="badge badge-gray">
                {commandCenter.gearSummary.byStatus.draft} Draft
              </span>
              <span className="badge badge-orange">
                {commandCenter.gearSummary.byStatus.reserved} Reserved
              </span>
              <span className="badge badge-green">
                {commandCenter.gearSummary.byStatus.checkedOut} Checked out
              </span>
              <span className="badge badge-blue">
                {commandCenter.gearSummary.byStatus.completed} Returned
              </span>
            </div>

            {/* Shift + gear grid */}
            <table className="data-table" style={{ fontSize: "var(--text-sm)" }}>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Type</th>
                  <th>Assigned</th>
                  <th>Shift</th>
                  <th>Gear</th>
                </tr>
              </thead>
              <tbody>
                {commandCenter.shifts.map((shift) => {
                  const hasMissingGear = shift.assignment && commandCenter.missingGear.some(
                    (m) => m.shiftId === shift.id
                  );
                  return (
                    <tr key={shift.id}>
                      <td>{AREA_LABELS[shift.area] ?? shift.area}</td>
                      <td>{WORKER_LABELS[shift.workerType] ?? shift.workerType}</td>
                      <td>{shift.assignment ? shift.assignment.userName : <span className="text-secondary">&mdash;</span>}</td>
                      <td>
                        {shift.assignment ? (
                          <span className="badge badge-green">Filled</span>
                        ) : shift.pendingRequests > 0 ? (
                          <span className="badge badge-orange">{shift.pendingRequests} req</span>
                        ) : (
                          <span className="badge badge-red">Open</span>
                        )}
                      </td>
                      <td>
                        {!shift.assignment ? (
                          <span className="text-secondary">&mdash;</span>
                        ) : hasMissingGear ? (
                          <span className="badge badge-red">None</span>
                        ) : shift.assignment.linkedBookingId ? (
                          <span className="badge badge-green">Linked</span>
                        ) : (
                          <span className="badge badge-orange">Unlinked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Missing gear list */}
            {commandCenter.missingGear.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 8 }}>
                  Missing Gear ({commandCenter.missingGear.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {commandCenter.missingGear.map((m) => (
                    <div
                      key={`${m.shiftId}-${m.userId}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--bg-secondary, #f3f4f6)",
                        borderRadius: 8,
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      <div>
                        <strong>{m.userName}</strong>
                        <span className="text-secondary" style={{ marginLeft: 8 }}>
                          {AREA_LABELS[m.area] ?? m.area}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={nudgingId === m.assignmentId}
                          onClick={async () => {
                            setNudgingId(m.assignmentId);
                            try {
                              await fetch("/api/notifications/nudge", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ assignmentId: m.assignmentId }),
                              });
                            } catch { /* ignore */ }
                            setNudgingId(null);
                          }}
                        >
                          {nudgingId === m.assignmentId ? "Sending..." : "Nudge"}
                        </Button>
                        {event && (
                          <Button size="sm" asChild>
                            <a
                              href={`/checkouts?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}&requesterUserId=${m.userId}`}
                              style={{ textDecoration: "none" }}
                            >
                              Create checkout
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
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
      <details style={{ marginTop: 16, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
        <summary style={{ cursor: "pointer" }}>Raw ICS data</summary>
        <pre style={{ background: "var(--bg-secondary, #f3f4f6)", padding: 12, borderRadius: 8, marginTop: 8, overflow: "auto" }}>
          {JSON.stringify({ rawSummary: event.rawSummary, rawLocationText: event.rawLocationText, rawDescription: event.rawDescription }, null, 2)}
        </pre>
      </details>
    </>
  );
}
