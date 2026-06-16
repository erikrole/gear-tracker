"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Clock, MapPin, RefreshCw, WifiOff, AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage, parseJsonSafely } from "@/lib/errors";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";
import { sportLabel } from "@/lib/sports";
import { formatTimeShort } from "@/lib/format";
import { formatCalendarEventDateRange } from "@/lib/calendar-event-dates";
import { VENUE_TONES, venueBadgeVariant, venueToneFromIsHome } from "@/lib/venue-tone";
import type { VenueTone } from "@/lib/venue-tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbLabel } from "@/components/BreadcrumbContext";
import type { CalendarEvent, ShiftGroupSummary, CommandCenterData } from "./_utils";
import { formatRelativeTime } from "@/lib/format";
import { EventSkeleton } from "./_components/EventSkeleton";
import { ShiftCoverageCard } from "./_components/ShiftCoverageCard";
import { EventTravelCard } from "./_components/EventTravelCard";
import { effectiveCallWindow, summarizeEffectiveCallWindows } from "@/lib/shift-call-windows";

type LocationOption = { id: string; name: string };

function opponentLabel(event: CalendarEvent) {
  if (!event.opponent) return null;
  if (event.isHome === false) return `at ${event.opponent}`;
  return `vs ${event.opponent}`;
}

function locationDisplay(event: CalendarEvent): string | null {
  if (event.locationLocked && event.location) return event.location.name;
  return event.rawLocationText ?? event.location?.name ?? null;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { setBreadcrumbLabel } = useBreadcrumbLabel();
  const [acting, setActing] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [crewSetupError, setCrewSetupError] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [subtitleDraft, setSubtitleDraft] = useState("");
  const [homeAwayDraft, setHomeAwayDraft] = useState<VenueTone>("neutral");
  const [locationIdDraft, setLocationIdDraft] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const savingRef = useRef(false);
  const creatingGroupRef = useRef(false);
  const nudgeRef = useRef(false);

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

  function openEdit() {
    if (!event) return;
    setTitleDraft(event.summary);
    setSubtitleDraft(event.subtitle ?? "");
    setHomeAwayDraft(venueToneFromIsHome(event.isHome));
    setLocationIdDraft(event.location?.id ?? "__none__");
    setEditOpen(true);

    // Fetch locations on every open so the list stays fresh
    setLocationsLoading(true);
    fetch("/api/locations")
      .then(async (res) => {
        if (handleAuthRedirect(res, `/events/${id}`)) return null;
        if (!res.ok) {
          toast.error(await parseErrorMessage(res, "Failed to load locations"));
          return null;
        }
        return parseJsonSafely<{ data?: LocationOption[] }>(res);
      })
      .then((json) => {
        if (json?.data) setLocations(json.data);
      })
      .catch((err) => {
        toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to load locations");
      })
      .finally(() => setLocationsLoading(false));
  }

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

  async function handleSaveEdit() {
    if (!event || !titleDraft.trim()) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};

      if (titleDraft.trim() !== event.summary) {
        body.summary = titleDraft.trim();
      }
      // Always send subtitle so clearing it is persisted
      body.subtitle = subtitleDraft.trim() || null;

      if (event.sportCode) {
        const newIsHome = homeAwayDraft === "home" ? true : homeAwayDraft === "away" ? false : null;
        if (newIsHome !== event.isHome) {
          body.isHome = newIsHome;
        }
      }

      const newLocationId = locationIdDraft === "__none__" ? null : locationIdDraft;
      if (newLocationId !== (event.location?.id ?? null)) {
        body.locationId = newLocationId;
      }

      if (Object.keys(body).length === 0) {
        setEditOpen(false);
        return;
      }

      const ok = await patchEvent(body);
      if (ok) {
        setEditOpen(false);
        reloadEvent();
        toast.success("Event updated");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleRevertField(field: "title" | "homeAway" | "location") {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const key = field === "title" ? "revertTitle" : field === "homeAway" ? "revertHomeAway" : "revertLocation";
      const ok = await patchEvent({ [key]: true });
      if (ok) {
        reloadEvent();
        toast.success("Reverted to synced value");
        // Refresh draft state from reloaded event
        setEditOpen(false);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleCreateShiftGroup() {
    if (!event) return;
    if (creatingGroupRef.current) return;
    creatingGroupRef.current = true;
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
      toast.error(err instanceof TypeError ? "You’re offline. Check your connection." : "Failed to set up crew");
    } finally {
      creatingGroupRef.current = false;
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

  const callSummary = shiftGroup?.shifts.length
    ? summarizeEffectiveCallWindows(
        shiftGroup.shifts.map((shift) => {
          const activeAssignment = shift.assignments.find(
            (assignment) => assignment.status === "DIRECT_ASSIGNED" || assignment.status === "APPROVED",
          );
          return effectiveCallWindow(shift, activeAssignment);
        }),
        { hideAllDayEventWindows: event.allDay, hideInheritedFullDayWindows: true },
      )
    : null;

  const eventDate = event.allDay
    ? formatCalendarEventDateRange(event, { includeYear: true })
    : new Date(event.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const opponentText = opponentLabel(event);
  const anyFieldLocked = event.summaryLocked || event.isHomeLocked || event.locationLocked;

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
                  onClick={openEdit}
                  aria-label={anyFieldLocked ? "Edit event with manual overrides" : "Edit event"}
                  className={anyFieldLocked ? "text-amber-500 hover:text-amber-600" : ""}
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{anyFieldLocked ? "Event has manual overrides" : "Edit event"}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={eventRefreshing}
                aria-label="Refresh event data"
              >
                <RefreshCw className={`size-4 ${eventRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {lastRefreshed ? `Updated ${formatRelativeTime(lastRefreshed.toISOString(), new Date())}` : "Refresh"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PageHeader>

      {event.subtitle && (
        <p className="text-sm font-medium text-muted-foreground -mt-3 mb-3">{event.subtitle}</p>
      )}

      {/* Edit Event Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
            <DialogDescription className="sr-only">
              Update event display fields without changing the source calendar import.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-title">Title</Label>
                {event.summaryLocked && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-600"
                    onClick={() => handleRevertField("title")}
                    disabled={saving}
                  >
                    <RotateCcw className="size-3" />
                    Revert to synced
                  </button>
                )}
              </div>
              <Input
                id="edit-title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={200}
                placeholder="Event title"
                disabled={saving}
              />
            </div>

            {/* Subtitle */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-subtitle">Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="edit-subtitle"
                value={subtitleDraft}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                maxLength={100}
                placeholder="e.g. Homecoming, Big Ten Tournament"
                disabled={saving}
              />
            </div>

            {/* Home / Away / Neutral — only meaningful for sport events */}
            {event.sportCode && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Home / Away / Neutral</Label>
                  {event.isHomeLocked && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-600"
                      onClick={() => handleRevertField("homeAway")}
                      disabled={saving}
                    >
                      <RotateCcw className="size-3" />
                      Revert to synced
                    </button>
                  )}
                </div>
                <ToggleGroup
                  type="single"
                  value={homeAwayDraft}
                  onValueChange={(val) => { if (val) setHomeAwayDraft(val as VenueTone); }}
                  disabled={saving}
                  className="h-9 w-full gap-0 rounded-md border border-input bg-background p-0.5"
                >
                  {(["home", "away", "neutral"] as VenueTone[]).map((tone) => (
                    <ToggleGroupItem
                      key={tone}
                      value={tone}
                      className="h-8 flex-1 rounded-sm px-2 text-sm data-[state=on]:bg-muted data-[state=on]:text-foreground capitalize"
                    >
                      {VENUE_TONES[tone].label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}

            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-location">Location</Label>
                {event.locationLocked && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-600"
                    onClick={() => handleRevertField("location")}
                    disabled={saving}
                  >
                    <RotateCcw className="size-3" />
                    Revert to synced
                  </button>
                )}
              </div>
              <Select
                value={locationIdDraft}
                onValueChange={setLocationIdDraft}
                disabled={saving || locationsLoading}
              >
                <SelectTrigger id="edit-location">
                  <SelectValue placeholder={locationsLoading ? "Loading…" : "No location"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No location</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {event.rawLocationText && (
                <p className="text-[11px] text-muted-foreground">ICS venue: {event.rawLocationText}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !titleDraft.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant={event.status === "CANCELLED" ? "red" : "green"}>
          {event.status.toLowerCase()}
        </Badge>
        {event.sportCode && <Badge variant="purple">{sportLabel(event.sportCode)}</Badge>}
        {event.opponent ? (
          <Badge variant={venueBadgeVariant(event.isHome)}>
            {VENUE_TONES[venueToneFromIsHome(event.isHome)].label}
          </Badge>
        ) : null}
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
        {callSummary?.label && (
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {callSummary.label}
          </span>
        )}
        {opponentText && <span>{opponentText}</span>}
        {locationDisplay(event) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            {locationDisplay(event)}
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
          eventAllDay={event.allDay}
          onUpdated={() => {
            reloadShiftGroup();
            if (isStaffOrAdmin) reloadCommandCenter();
          }}
          onNudge={async (assignmentId, userName) => {
            if (nudgeRef.current || acting) return;
            nudgeRef.current = true;
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
              nudgeRef.current = false;
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
