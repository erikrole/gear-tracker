"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Calendar, Clock, MapPin, RefreshCw, WifiOff, AlertTriangle } from "lucide-react";
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";
const ShiftDetailPanel = dynamic(() => import("@/components/ShiftDetailPanel"), { ssr: false });
import { sportLabel } from "@/lib/sports";
import { formatTimeShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import type { CalendarEvent, ShiftGroupSummary, CommandCenterData } from "./_utils";
import { formatDate } from "./_utils";
import { formatRelativeTime } from "@/lib/format";
import { EventSkeleton } from "./_components/EventSkeleton";
import { ShiftCoverageCard } from "./_components/ShiftCoverageCard";
import { EventTravelCard } from "./_components/EventTravelCard";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // ── Data fetching ──
  const {
    data: event,
    loading: eventLoading,
    refreshing: eventRefreshing,
    error: fetchError,
    lastRefreshed,
    reload: reloadEvent,
  } = useFetch<CalendarEvent>({
    url: `/api/calendar-events/${id}`,
    returnTo: `/events/${id}`,
  });

  const {
    data: shiftGroup,
    reload: reloadShiftGroup,
  } = useFetch<ShiftGroupSummary | null>({
    url: `/api/shift-groups?eventId=${id}`,
    transform: (json) => {
      const groups = (json.data ?? []) as ShiftGroupSummary[];
      return groups[0] ?? null;
    },
  });

  const { data: meData } = useFetch<{ id: string; role: string }>({
    url: "/api/me",
    transform: (json) => (json as Record<string, unknown>).user as { id: string; role: string },
    refetchOnFocus: false,
  });
  const currentUserId = meData?.id ?? "";
  const currentUserRole = meData?.role ?? "STUDENT";
  const isStaffOrAdmin = currentUserRole === "STAFF" || currentUserRole === "ADMIN";

  const {
    data: commandCenter,
    reload: reloadCommandCenter,
  } = useFetch<CommandCenterData | null>({
    url: `/api/calendar-events/${id}/command-center`,
    transform: (json) => (json?.data as CommandCenterData) ?? null,
    enabled: isStaffOrAdmin,
  });

  useEffect(() => {
    if (event?.summary) setBreadcrumbLabel(event.summary);
  }, [event?.summary, setBreadcrumbLabel]);

  const handleRefresh = useCallback(() => {
    reloadEvent();
    reloadShiftGroup();
    if (isStaffOrAdmin) reloadCommandCenter();
  }, [reloadEvent, reloadShiftGroup, reloadCommandCenter, isStaffOrAdmin]);

  const refreshing = eventRefreshing;

  async function handleCreateShiftGroup() {
    if (!event) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/shift-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        reloadShiftGroup();
        if (isStaffOrAdmin) reloadCommandCenter();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create shift group");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      toast.error("Network error");
    }
    setCreatingGroup(false);
  }

  // Error state
  if (fetchError && !event) {
    return (
      <div className="py-10 px-5 max-w-md mx-auto">
        <Alert variant="destructive">
          {fetchError === "network" ? <WifiOff className="size-4" /> : <AlertTriangle className="size-4" />}
          <AlertTitle>{fetchError === "network" ? "You’re offline" : "Failed to load event"}</AlertTitle>
          <AlertDescription>
            {fetchError === "network"
              ? "Check your connection and try again."
              : "The event could not be found or the server returned an error."}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-3 justify-center">
          <Button variant="outline" onClick={reloadEvent}>Try again</Button>
          <Button variant="ghost" asChild>
            <Link href="/schedule">Back to schedule</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (eventLoading || !event) return <EventSkeleton />;

  const dateParam = encodeURIComponent(event.startsAt);
  const endParam = encodeURIComponent(event.endsAt);
  const titleParam = encodeURIComponent(event.summary);
  const locationParam = event.location?.id ? `&locationId=${event.location.id}` : "";
  const eventParam = `&eventId=${id}`;

  // Earliest shift call time across all areas
  const callTime = shiftGroup?.shifts.length
    ? shiftGroup.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, shiftGroup.shifts[0].startsAt)
    : null;
  const showCallTime = callTime && callTime !== event.startsAt;

  const eventDate = event.allDay
    ? formatDate(event.startsAt)
    : new Date(event.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

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
              {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), new Date())}` : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PageHeader>

      {/* Status/sport/home-away chips */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant={event.status === "CANCELLED" ? "red" : "green"}>
          {event.status.toLowerCase()}
        </Badge>
        {event.sportCode && (
          <Badge variant="purple">{sportLabel(event.sportCode)}</Badge>
        )}
        {event.isHome === true && <Badge variant="green">Home</Badge>}
        {event.isHome === false && <Badge variant="orange">Away</Badge>}
        {event.isHome === null && event.opponent && <Badge variant="blue">Neutral</Badge>}
      </div>

      {/* Key facts strip */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0" />
          {eventDate}
        </span>
        {!event.allDay && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" />
            {formatTimeShort(event.startsAt)} – {formatTimeShort(event.endsAt)}
          </span>
        )}
        {showCallTime && (
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            Call {formatTimeShort(callTime!)}
          </span>
        )}
        {event.opponent && (
          <span>vs {event.opponent}</span>
        )}
        {(event.rawLocationText || event.location) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            {event.rawLocationText ?? event.location?.name}
          </span>
        )}
      </div>

      {/* Crew section */}
      {shiftGroup ? (
        <ShiftCoverageCard
          shiftGroup={shiftGroup}
          commandCenter={commandCenter}
          currentUserRole={currentUserRole}
          acting={acting}
          linkParams={{ titleParam, dateParam, endParam, locationParam, eventParam }}
          onManageShifts={() => setSelectedGroupId(shiftGroup.id)}
          onNudge={async (assignmentId, userName) => {
            if (acting) return;
            setActing(assignmentId);
            try {
              const res = await fetch("/api/notifications/nudge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignmentId }),
              });
              if (handleAuthRedirect(res)) return;
              if (!res.ok) {
                const msg = await parseErrorMessage(res, "Failed to send nudge");
                toast.error(msg);
              } else {
                toast.success(`Nudge sent to ${userName}`);
              }
            } catch (err) {
              if (isAbortError(err)) return;
              const kind = classifyError(err);
              toast.error(
                kind === "network"
                  ? "You’re offline — nudge not sent"
                  : "Something went wrong — nudge not sent",
              );
            } finally {
              setActing(null);
            }
          }}
        />
      ) : isStaffOrAdmin ? (
        <Card className="mt-4">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">No crew scheduled for this event.</p>
            <Button size="sm" onClick={handleCreateShiftGroup} disabled={creatingGroup}>
              {creatingGroup ? "Setting up…" : "Set up crew"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Away travel roster */}
      {event.isHome === false && event.sportCode && (
        <EventTravelCard
          eventId={id}
          sportCode={event.sportCode}
          isStaff={isStaffOrAdmin}
        />
      )}

      {/* Gear actions — secondary, below crew context */}
      <div className="flex gap-2 mt-6 max-sm:flex-col sm:flex-row flex-wrap">
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

      {/* Shift detail panel */}
      {selectedGroupId && (
        <ShiftDetailPanel
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onUpdated={() => {
            reloadShiftGroup();
            if (isStaffOrAdmin) reloadCommandCenter();
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
