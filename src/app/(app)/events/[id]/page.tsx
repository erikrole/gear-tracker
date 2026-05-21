"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, MapPin, RefreshCw, WifiOff, AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";
import { sportLabel } from "@/lib/sports";
import { formatTimeShort } from "@/lib/format";
import { VENUE_TONES, venueBadgeVariant, venueToneFromIsHome } from "@/lib/venue-tone";
import type { VenueTone } from "@/lib/venue-tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import type { CalendarEvent, ShiftGroupSummary, CommandCenterData } from "./_utils";
import { formatDate } from "./_utils";
import { formatRelativeTime } from "@/lib/format";
import { EventSkeleton } from "./_components/EventSkeleton";
import { ShiftCoverageCard } from "./_components/ShiftCoverageCard";
import { EventTravelCard } from "./_components/EventTravelCard";

function opponentLabel(event: CalendarEvent) {
  if (!event.opponent) return null;
  if (event.isHome === false) return `at ${event.opponent}`;
  return `vs ${event.opponent}`;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();
  const [acting, setActing] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [crewSetupError, setCrewSetupError] = useState("");
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingHomeAway, setSavingHomeAway] = useState(false);

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

  async function patchEvent(body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/calendar-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (handleAuthRedirect(res)) return false;
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Failed to update event");
        toast.error(msg);
        return false;
      }
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      toast.error("Network error");
      return false;
    }
  }

  async function handleSaveTitle() {
    if (!titleDraft.trim()) return;
    setSavingTitle(true);
    try {
      const ok = await patchEvent({ summary: titleDraft.trim() });
      if (ok) { setTitleDialogOpen(false); reloadEvent(); toast.success("Title updated"); }
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleRevertTitle() {
    setSavingTitle(true);
    try {
      const ok = await patchEvent({ revertTitle: true });
      if (ok) { setTitleDialogOpen(false); reloadEvent(); toast.success("Title reverted"); }
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleSetHomeAway(tone: VenueTone) {
    const isHomeValue = tone === "home" ? true : tone === "away" ? false : null;
    setSavingHomeAway(true);
    try {
      const ok = await patchEvent({ isHome: isHomeValue });
      if (ok) reloadEvent();
    } finally {
      setSavingHomeAway(false);
    }
  }

  async function handleRevertHomeAway() {
    setSavingHomeAway(true);
    try {
      const ok = await patchEvent({ revertHomeAway: true });
      if (ok) reloadEvent();
    } finally {
      setSavingHomeAway(false);
    }
  }

  async function handleCreateShiftGroup() {
    if (!event) return;
    setCreatingGroup(true);
    setCrewSetupError("");
    try {
      const res = await fetch("/api/shift-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        toast.success("Crew setup created");
        reloadShiftGroup();
        if (isStaffOrAdmin) reloadCommandCenter();
      } else {
        const msg = await parseErrorMessage(res, "Failed to create shift group");
        setCrewSetupError(msg);
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      setCrewSetupError("Network error - check your connection");
      toast.error("Network error");
    } finally {
      setCreatingGroup(false);
    }
  }

  if (fetchError && !event) {
    return (
      <div className="py-10 px-5 max-w-md mx-auto">
        <Alert variant="destructive">
          {fetchError === "network" ? <WifiOff className="size-4" /> : <AlertTriangle className="size-4" />}
          <AlertTitle>{fetchError === "network" ? "You're offline" : "Failed to load event"}</AlertTitle>
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

  const callTime = shiftGroup?.shifts.length
    ? shiftGroup.shifts.reduce((min, s) => s.startsAt < min ? s.startsAt : min, shiftGroup.shifts[0]!.startsAt)
    : null;
  const showCallTime = callTime && callTime !== event.startsAt;

  const eventDate = event.allDay
    ? formatDate(event.startsAt)
    : new Date(event.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const opponentText = opponentLabel(event);

  return (
    <>
      <PageHeader title={event.summary}>
        <TooltipProvider>
          {isStaffOrAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setTitleDraft(event.summary); setTitleDialogOpen(true); }}
                  className={event.summaryLocked ? "text-amber-500 hover:text-amber-600" : ""}
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{event.summaryLocked ? "Title edited — click to change or revert" : "Edit title"}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={eventRefreshing}>
                <RefreshCw className={`size-4 ${eventRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), new Date())}` : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PageHeader>

      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit event title</DialogTitle>
          </DialogHeader>
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); }}
            maxLength={200}
            placeholder="Event title"
            disabled={savingTitle}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {event.summaryLocked && (
              <Button
                variant="ghost"
                size="sm"
                className="sm:mr-auto text-muted-foreground"
                onClick={handleRevertTitle}
                disabled={savingTitle}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Revert to synced
              </Button>
            )}
            <Button variant="outline" onClick={() => setTitleDialogOpen(false)} disabled={savingTitle}>Cancel</Button>
            <Button onClick={handleSaveTitle} disabled={savingTitle || !titleDraft.trim()}>
              {savingTitle ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant={event.status === "CANCELLED" ? "red" : "green"}>
          {event.status.toLowerCase()}
        </Badge>
        {event.sportCode && <Badge variant="purple">{sportLabel(event.sportCode)}</Badge>}
        {event.opponent && (
          isStaffOrAdmin ? (
            <div className="flex items-center gap-1.5">
              <ToggleGroup
                type="single"
                value={venueToneFromIsHome(event.isHome)}
                onValueChange={(val) => { if (val) handleSetHomeAway(val as VenueTone); }}
                disabled={savingHomeAway}
                className="h-7 gap-0 rounded-md border border-input bg-background p-0.5"
              >
                {(["home", "away", "neutral"] as VenueTone[]).map((tone) => (
                  <ToggleGroupItem
                    key={tone}
                    value={tone}
                    className="h-6 rounded-sm px-2 text-xs data-[state=on]:bg-muted data-[state=on]:text-foreground"
                  >
                    {VENUE_TONES[tone].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {event.isHomeLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-amber-500 hover:text-amber-600"
                      onClick={handleRevertHomeAway}
                      disabled={savingHomeAway}
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Revert to synced value</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <Badge variant={venueBadgeVariant(event.isHome)}>
              {VENUE_TONES[venueToneFromIsHome(event.isHome)].label}
            </Badge>
          )
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0" />
          {eventDate}
        </span>
        {!event.allDay && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" />
            {formatTimeShort(event.startsAt)} - {formatTimeShort(event.endsAt)}
          </span>
        )}
        {showCallTime && (
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            Call {formatTimeShort(callTime!)}
          </span>
        )}
        {opponentText && <span>{opponentText}</span>}
        {(event.rawLocationText || event.location) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            {event.rawLocationText ?? event.location?.name}
          </span>
        )}
      </div>

      {shiftGroup ? (
        <ShiftCoverageCard
          shiftGroup={shiftGroup}
          commandCenter={commandCenter}
          currentUserRole={currentUserRole}
          acting={acting}
          linkParams={{ titleParam, dateParam, endParam, locationParam, eventParam }}
          onUpdated={() => {
            reloadShiftGroup();
            if (isStaffOrAdmin) reloadCommandCenter();
          }}
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
              toast.error(kind === "network" ? "You're offline - nudge not sent" : "Something went wrong - nudge not sent");
            } finally {
              setActing(null);
            }
          }}
        />
      ) : isStaffOrAdmin ? (
        <Card className="mt-4">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            {crewSetupError && (
              <Alert variant="destructive" className="text-left">
                <AlertDescription>{crewSetupError}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">No crew scheduled for this event.</p>
            <Button size="sm" onClick={handleCreateShiftGroup} disabled={creatingGroup}>
              {creatingGroup ? "Setting up..." : "Set up crew"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {event.isHome === false && event.sportCode && (
        <EventTravelCard eventId={id} sportCode={event.sportCode} isStaff={isStaffOrAdmin} />
      )}

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
