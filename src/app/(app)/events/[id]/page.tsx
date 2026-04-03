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
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import type { CalendarEvent, ShiftGroupSummary, CommandCenterData } from "./_utils";
import { formatDateTime, formatDate, timeAgo } from "./_utils";
import { EventSkeleton } from "./_components/EventSkeleton";
import { ShiftCoverageCard } from "./_components/ShiftCoverageCard";

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
  const eventParam = `&eventId=${id}`;

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
      </div>

      {/* Action CTAs — Checkout is primary (most common immediate action) */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button asChild className="min-h-11 px-5">
          <Link href={`/checkouts?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}`}>
            Checkout to this event
          </Link>
        </Button>
        <Button variant="outline" asChild className="min-h-11 px-5">
          <Link href={`/reservations?title=${titleParam}&startsAt=${dateParam}&endsAt=${endParam}${locationParam}${eventParam}`}>
            Reserve gear for this event
          </Link>
        </Button>
      </div>

      {/* Event details */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <DataList
            items={[
              ...(event.opponent
                ? [{ label: "Opponent", value: event.opponent }]
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
            ]}
          />
        </CardContent>
      </Card>

      {/* Shift coverage (merged with command center for staff) */}
      {shiftGroup && (
        <ShiftCoverageCard
          shiftGroup={shiftGroup}
          commandCenter={commandCenter}
          currentUserRole={currentUserRole}
          nudgingId={nudgingId}
          linkParams={{ titleParam, dateParam, endParam, locationParam, eventParam }}
          onManageShifts={() => setSelectedGroupId(shiftGroup.id)}
          onNudge={async (assignmentId, userName) => {
            setNudgingId(assignmentId);
            try {
              const res = await fetch("/api/notifications/nudge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignmentId }),
              });
              if (res.status === 401) { window.location.href = "/login"; return; }
              if (res.ok) {
                toast(`Nudge sent to ${userName}`, "success");
              } else {
                toast("Failed to send nudge", "error");
              }
            } catch {
              toast("Network error — nudge not sent", "error");
            }
            setNudgingId(null);
          }}
        />
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
      {currentUserRole === "ADMIN" && (
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Raw ICS data</summary>
          <pre className="bg-muted p-3 rounded-lg mt-2 overflow-auto">
            {JSON.stringify({ rawSummary: event.rawSummary, rawLocationText: event.rawLocationText, rawDescription: event.rawDescription }, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}
