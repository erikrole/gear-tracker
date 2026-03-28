"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, WifiOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/Toast";
const ShiftDetailPanel = dynamic(() => import("@/components/ShiftDetailPanel"), { ssr: false });
import DataList from "@/components/DataList";
import { sportLabel } from "@/lib/sports";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";

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

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Loading skeleton matching the page layout */
function EventSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-11 w-48" />
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-16" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();
  const { toast } = useToast();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [fetchError, setFetchError] = useState<"network" | "server" | null>(null);
  const [shiftGroup, setShiftGroup] = useState<ShiftGroupSummary | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("STUDENT");
  const [commandCenter, setCommandCenter] = useState<CommandCenterData | null>(null);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  // Tick for "Updated X ago" freshness
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const loadEvent = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/calendar-events/${id}`, { signal });
      if (signal?.aborted) return;
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setFetchError("server"); return; }
      const json = await res.json();
      if (json?.data) {
        setEvent(json.data);
        setBreadcrumbLabel(json.data.summary);
        setFetchError(null);
        setLastUpdated(new Date());
      } else {
        setFetchError("server");
      }
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFetchError("network");
    }
  }, [id]);

  const loadShiftGroup = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/shift-groups?eventId=${id}`, { signal });
      if (signal?.aborted) return;
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        const json = await res.json();
        const group = (json.data ?? [])[0];
        if (group) setShiftGroup(group);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, [id]);

  const loadCommandCenter = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/calendar-events/${id}/command-center`, { signal });
      if (signal?.aborted) return;
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setCommandCenter(json.data);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, [id]);

  // Initial load with AbortController
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    loadEvent(controller.signal);
    loadShiftGroup(controller.signal);

    fetch("/api/me", { signal: controller.signal })
      .then((r) => {
        if (r.status === 401) { window.location.href = "/login"; return null; }
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (controller.signal.aborted) return;
        if (j?.user) {
          setCurrentUserId(j.user.id);
          setCurrentUserRole(j.user.role);
          if (j.user.role === "STAFF" || j.user.role === "ADMIN") {
            loadCommandCenter(controller.signal);
          }
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [id, loadEvent, loadShiftGroup, loadCommandCenter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    try {
      await Promise.all([
        loadEvent(controller.signal),
        loadShiftGroup(controller.signal),
        ...(currentUserRole === "STAFF" || currentUserRole === "ADMIN"
          ? [loadCommandCenter(controller.signal)]
          : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadEvent, loadShiftGroup, loadCommandCenter, currentUserRole]);

  // Error state
  if (fetchError && !event) {
    return (
      <div className="py-10 px-5 max-w-md mx-auto">
        <Alert variant="destructive">
          {fetchError === "network" ? <WifiOff className="size-4" /> : <AlertTriangle className="size-4" />}
          <AlertTitle>{fetchError === "network" ? "You\u2019re offline" : "Failed to load event"}</AlertTitle>
          <AlertDescription>
            {fetchError === "network"
              ? "Check your connection and try again."
              : "The event could not be found or the server returned an error."}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setFetchError(null); handleRefresh(); }}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/schedule">Back to schedule</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (!event) {
    return <EventSkeleton />;
  }

  const dateParam = encodeURIComponent(event.startsAt);
  const endParam = encodeURIComponent(event.endsAt);
  const titleParam = encodeURIComponent(event.summary);
  const locationParam = event.location?.id ? `&locationId=${event.location.id}` : "";

  return (
    <>
      <PageHeader title={event.summary}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PageHeader>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Badge variant={event.status === "CANCELLED" ? "red" : "green"}>
          {event.status.toLowerCase()}
        </Badge>
        {event.sportCode && (
          <Badge variant="purple">{sportLabel(event.sportCode)}</Badge>
        )}
        {event.isHome !== null && (
          <Badge variant={event.isHome ? "green" : "orange"}>
            {event.isHome ? "Home" : "Away"}
          </Badge>
        )}
        {event.location ? (
          <Badge variant="blue">{event.location.name}</Badge>
        ) : (
          <Badge variant="orange">needs location mapping</Badge>
        )}
        {event.source && (
          <span className="text-xs text-muted-foreground">
            via {event.source.name}
          </span>
        )}
      </div>

      {/* Action CTAs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button asChild className="min-h-11 px-5">
          <Link href={`/reservations?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`}>
            Reserve gear for this event
          </Link>
        </Button>
        <Button variant="outline" asChild className="min-h-11 px-5">
          <Link href={`/checkouts?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}`}>
            Checkout to this event
          </Link>
        </Button>
      </div>

      {/* Event details */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
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
                ? [{ label: "Description", value: <span className="whitespace-pre-wrap">{event.description}</span> }]
                : []),
            ]}
          />
        </CardContent>
      </Card>

      {/* Shift coverage */}
      {shiftGroup && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Shift Coverage</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSelectedGroupId(shiftGroup.id)}>
              Manage shifts
            </Button>
          </CardHeader>
          <CardContent>
            {shiftGroup.isPremier && (
              <div className="mb-3">
                <Badge variant="blue">Premier Event</Badge>
                <span className="text-xs text-muted-foreground ml-1.5">Students can request shifts</span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftGroup.shifts.map((shift) => {
                  const activeAssignment = shift.assignments.find(
                    (a) => a.status === "DIRECT_ASSIGNED" || a.status === "APPROVED"
                  );
                  const pendingCount = shift.assignments.filter((a) => a.status === "REQUESTED").length;
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>{AREA_LABELS[shift.area] ?? shift.area}</TableCell>
                      <TableCell>{WORKER_LABELS[shift.workerType] ?? shift.workerType}</TableCell>
                      <TableCell>
                        {activeAssignment ? (
                          <span className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarFallback className={`text-[10px] font-medium ${getAvatarColor(activeAssignment.user.name)}`}>
                                {getInitials(activeAssignment.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            {activeAssignment.user.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {activeAssignment ? (
                          <Badge variant="green">Filled</Badge>
                        ) : pendingCount > 0 ? (
                          <Badge variant="orange">{pendingCount} request{pendingCount > 1 ? "s" : ""}</Badge>
                        ) : (
                          <Badge variant="red">Open</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Command Center (staff/admin only) */}
      {commandCenter && commandCenter.shifts.length > 0 && (currentUserRole === "STAFF" || currentUserRole === "ADMIN") && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Command Center</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Gear status pills */}
            <div className="flex gap-2 flex-wrap mb-4">
              <Badge variant="gray">
                {commandCenter.gearSummary.byStatus.draft} Draft
              </Badge>
              <Badge variant="orange">
                {commandCenter.gearSummary.byStatus.reserved} Reserved
              </Badge>
              <Badge variant="green">
                {commandCenter.gearSummary.byStatus.checkedOut} Checked out
              </Badge>
              <Badge variant="blue">
                {commandCenter.gearSummary.byStatus.completed} Returned
              </Badge>
            </div>

            {/* Shift + gear grid */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Gear</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commandCenter.shifts.map((shift) => {
                  const hasMissingGear = shift.assignment && commandCenter.missingGear.some(
                    (m) => m.shiftId === shift.id
                  );
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>{AREA_LABELS[shift.area] ?? shift.area}</TableCell>
                      <TableCell>{WORKER_LABELS[shift.workerType] ?? shift.workerType}</TableCell>
                      <TableCell>{shift.assignment ? shift.assignment.userName : <span className="text-muted-foreground">&mdash;</span>}</TableCell>
                      <TableCell>
                        {shift.assignment ? (
                          <Badge variant="green">Filled</Badge>
                        ) : shift.pendingRequests > 0 ? (
                          <Badge variant="orange">{shift.pendingRequests} req</Badge>
                        ) : (
                          <Badge variant="red">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!shift.assignment ? (
                          <span className="text-muted-foreground">&mdash;</span>
                        ) : hasMissingGear ? (
                          <Badge variant="red">None</Badge>
                        ) : shift.assignment.linkedBookingId ? (
                          <Badge variant="green">Linked</Badge>
                        ) : (
                          <Badge variant="orange">Unlinked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Missing gear list */}
            {commandCenter.missingGear.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm mb-2">
                  Missing Gear ({commandCenter.missingGear.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {commandCenter.missingGear.map((m) => (
                    <div
                      key={`${m.shiftId}-${m.userId}`}
                      className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm"
                    >
                      <div>
                        <strong>{m.userName}</strong>
                        <span className="text-muted-foreground ml-2">
                          {AREA_LABELS[m.area] ?? m.area}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={nudgingId === m.assignmentId}
                          onClick={async () => {
                            setNudgingId(m.assignmentId);
                            try {
                              const res = await fetch("/api/notifications/nudge", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ assignmentId: m.assignmentId }),
                              });
                              if (res.status === 401) { window.location.href = "/login"; return; }
                              if (res.ok) {
                                toast(`Nudge sent to ${m.userName}`, "success");
                              } else {
                                toast("Failed to send nudge", "error");
                              }
                            } catch {
                              toast("Network error — nudge not sent", "error");
                            }
                            setNudgingId(null);
                          }}
                        >
                          {nudgingId === m.assignmentId ? "Sending..." : "Nudge"}
                        </Button>
                        <Button size="sm" asChild>
                          <Link
                            href={`/checkouts?create=true&title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}&requesterUserId=${m.userId}`}
                          >
                            Create checkout
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shift detail panel */}
      {selectedGroupId && (
        <ShiftDetailPanel
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onUpdated={() => {
            const signal = abortRef.current?.signal;
            loadShiftGroup(signal);
            if (currentUserRole === "STAFF" || currentUserRole === "ADMIN") {
              loadCommandCenter(signal);
            }
          }}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}

      {/* Debug info for admins */}
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Raw ICS data</summary>
        <pre className="bg-muted p-3 rounded-lg mt-2 overflow-auto">
          {JSON.stringify({ rawSummary: event.rawSummary, rawLocationText: event.rawLocationText, rawDescription: event.rawDescription }, null, 2)}
        </pre>
      </details>
    </>
  );
}
