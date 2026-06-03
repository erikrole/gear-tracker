"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClockIcon, ClockIcon, CheckIcon, LinkIcon, MapPinIcon, XIcon } from "lucide-react";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { formatChipTime, formatDateTime } from "@/lib/format";
import { formatCalendarEventDateRange } from "@/lib/calendar-event-dates";
import { cn } from "@/lib/utils";
import { VENUE_TONES, venueBadgeVariant, venueToneFromIsHome } from "@/lib/venue-tone";
import { FormRow, FormRow2Col, SectionHeading } from "@/components/form-layout";
import {
  toLocalDateTimeValue,
  type FormUser,
  type Location,
  type CalendarEvent,
} from "@/components/booking-list/types";
import { MAX_SCROLL_HEIGHT } from "./constants";
import type { FormState, FormAction, ShiftInfo } from "@/components/create-booking/types";

type WizardConfig = {
  kind: "CHECKOUT" | "RESERVATION";
  label: string;
  requesterLabel: string;
  startLabel: string;
  endLabel: string;
  defaultTieToEvent: boolean;
};

type Props = {
  form: FormState;
  dispatch: Dispatch<FormAction>;
  config: WizardConfig;
  users: FormUser[];
  locations: Location[];
  kits: { id: string; name: string }[];
  kitId: string;
  setKitId: Dispatch<SetStateAction<string>>;
  events: CalendarEvent[];
  eventsLoading: boolean;
  myShiftForEvent: ShiftInfo | null;
  toggleEvent: (ev: CalendarEvent) => { ok: boolean; reason?: string };
};

function eventDateLabel(ev: CalendarEvent, includeYear = false) {
  return ev.allDay
    ? formatCalendarEventDateRange(ev, { includeYear })
    : includeYear
      ? formatDateTime(ev.startsAt)
      : formatChipTime(ev.startsAt);
}

export function WizardStep1({
  form,
  dispatch,
  config,
  users,
  locations,
  kits,
  kitId,
  setKitId,
  events,
  eventsLoading,
  myShiftForEvent,
  toggleEvent,
}: Props) {
  const selectedEventIds = new Set(form.selectedEvents.map((e) => e.id));
  const atCap = form.selectedEvents.length >= 3;
  const selectedLocationName = locations.find((l) => l.id === form.locationId)?.name || "";
  const primaryEventLocation =
    form.selectedEvents[0]?.location?.name ||
    form.selectedEvents[0]?.rawLocationText ||
    selectedLocationName;
  const contextBadge = form.tieToEvent
    ? form.selectedEvents.length > 0
      ? "Event linked"
      : "Event optional"
    : "Ad hoc";
  const contextDescription = form.tieToEvent
    ? form.selectedEvents.length > 0
      ? "Window and title are filled from the selected event span. You can still adjust the booking details below."
      : "Select up to 3 events to fill the booking details, or use ad hoc details when this booking is not tied to the calendar."
    : "Manual details will create a booking without calendar-event reporting links.";
  const contextBadgeVariant: "green" | "blue" | "secondary" = form.tieToEvent
    ? form.selectedEvents.length > 0
      ? "green"
      : "blue"
    : "secondary";
  const selectedAllDaySpan =
    form.selectedEvents.length > 0 && form.selectedEvents.every((ev) => ev.allDay);
  const bookingWindowLabel = selectedAllDaySpan
    ? `${formatCalendarEventDateRange(
        { startsAt: form.startsAt, endsAt: form.endsAt, allDay: true },
        { includeYear: true },
      )} · All day`
    : `${formatDateTime(form.startsAt)} to ${formatDateTime(form.endsAt)}`;
  return (
    <div className="flex flex-col gap-10">

      {/* ═══ Event Section ═══ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Event context</SectionHeading>
          <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-3">
            <Switch
              id="booking-link-to-event"
              aria-label="Link to event"
              checked={form.tieToEvent}
              onCheckedChange={(value) => dispatch({ type: "SET_TIE_TO_EVENT", value })}
            />
            <Label htmlFor="booking-link-to-event" className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground">
              Link to event
            </Label>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-card/70 p-3 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <LinkIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {form.tieToEvent ? "Calendar-linked booking" : "Manual booking"}
                </span>
                <Badge variant={contextBadgeVariant} size="sm">
                  {contextBadge}
                </Badge>
                {form.tieToEvent && (
                  <Badge variant="outline" size="sm">
                    {form.selectedEvents.length}/3 events
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {contextDescription}
              </p>
            </div>
            {form.tieToEvent && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: false })}
                className="shrink-0"
              >
                Use ad hoc details
              </Button>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-2 rounded-sm border border-border/60 bg-background px-3 py-2">
              <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Window
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground">
                  {bookingWindowLabel}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2 rounded-sm border border-border/60 bg-background px-3 py-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Location
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                  {primaryEventLocation || "Select a location below"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {form.tieToEvent && (
          <div className="flex flex-col gap-4 rounded-md border border-border/60 bg-card/70 p-2 shadow-xs">
            {/* Sport filter */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-sport-filter-trigger" className="text-sm font-medium">Filter by sport</Label>
              <Select
                name="booking-sport-filter"
                value={form.sport || "__all__"}
                onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__all__" ? "" : v })}
              >
                <SelectTrigger id="booking-sport-filter-trigger">
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sports</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected-event chips */}
            {form.selectedEvents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.selectedEvents.map((ev) => (
                  <Button
                    key={ev.id}
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => toggleEvent(ev)}
                    className="rounded-full"
                    aria-label={`Remove ${ev.opponent ?? ev.summary}`}
                  >
                    <span className="font-medium">
                      {eventDateLabel(ev)}
                      {" · "}
                      {ev.opponent ?? ev.summary}
                    </span>
                    <XIcon />
                  </Button>
                ))}
              </div>
            )}

            {/* Events list */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Upcoming events — next 30 days{form.sport ? ` \u00b7 ${sportLabel(form.sport)}` : ""}
              </span>

              {eventsLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading events\u2026
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-sm border border-dashed p-4 text-sm text-muted-foreground">
                  <p className="leading-relaxed">
                    No upcoming events{form.sport ? ` for ${sportLabel(form.sport)}` : ""}. Create this as an ad hoc booking instead.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: false })}
                  >
                    Use ad hoc details
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col gap-0.5 overflow-y-auto border border-border rounded-sm p-1"
                  style={{ maxHeight: MAX_SCROLL_HEIGHT }}
                >
                  {events.map((ev) => {
                    const selected = selectedEventIds.has(ev.id);
                    const disabled = !selected && atCap;
                    return (
                      <Button
                        key={ev.id}
                        type="button"
                        variant={selected ? "default" : "ghost"}
                        onClick={() => toggleEvent(ev)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={cn(
                          "group h-auto min-h-11 w-full justify-start gap-3 rounded-sm px-3 py-2.5 text-left",
                          selected
                            ? "text-primary-foreground hover:bg-primary/90"
                            : disabled
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-muted/60",
                        )}
                      >
                        {/* Match info — sport name inline, no chip */}
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "text-sm font-semibold truncate",
                              selected ? "text-primary-foreground" : "text-foreground",
                            )}
                          >
                            {ev.sportCode && (
                              <span
                                className={cn(
                                  "font-normal",
                                  selected ? "text-primary-foreground/75" : "text-muted-foreground",
                                )}
                              >
                                {sportLabel(ev.sportCode)}
                                {ev.opponent ? " \u00b7 " : ""}
                              </span>
                            )}
                            {ev.opponent ? (
                              <>{ev.isHome === false ? "at " : "vs "}{ev.opponent}</>
                            ) : (
                              !ev.sportCode ? ev.summary : ""
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-xs mt-0.5 truncate",
                              selected ? "text-primary-foreground/70" : "text-muted-foreground",
                            )}
                          >
                            {eventDateLabel(ev, true)}
                            {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                            {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                          </div>
                        </div>

                        {/* Venue badge */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {ev.opponent && (
                            <Badge variant={venueBadgeVariant(ev.isHome)} size="sm">
                              {VENUE_TONES[venueToneFromIsHome(ev.isHome)].label}
                            </Badge>
                          )}
                        </div>

                        {/* Selected check */}
                        {selected && (
                          <CheckIcon className="size-4 shrink-0 text-primary-foreground ml-0.5" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shift context banner (primary event) */}
        {myShiftForEvent && form.selectedEvents.length > 0 && (
          <div
            className="flex items-center gap-3 rounded-r-sm border-l-[3px] border-l-primary bg-muted/40 px-3 py-2.5"
          >
            <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold">Your shift</span>
              <span className="text-xs text-muted-foreground ml-1.5">
                {myShiftForEvent.area} &middot;{" "}
                {new Date(myShiftForEvent.startsAt)
                  .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  .toLowerCase()}
                {" \u2013 "}
                {new Date(myShiftForEvent.endsAt)
                  .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  .toLowerCase()}
              </span>
            </div>
            {myShiftForEvent.gearStatus !== "none" && (
              <Badge
                variant={
                  myShiftForEvent.gearStatus === "checked_out"
                    ? "green"
                    : myShiftForEvent.gearStatus === "reserved"
                      ? "orange"
                      : "gray"
                }
                size="sm"
              >
                {myShiftForEvent.gearStatus === "checked_out"
                  ? "Gear out"
                  : myShiftForEvent.gearStatus === "reserved"
                    ? "Gear reserved"
                    : "Draft"}
              </Badge>
            )}
          </div>
        )}
      </section>

      {/* ═══ Booking Details Section ═══ */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Booking details</SectionHeading>

        <div className="flex flex-col gap-4 rounded-md border border-border/60 bg-card/70 p-2 shadow-xs">
          {/* Title */}
          <FormRow
            label={form.tieToEvent && form.selectedEvents.length > 0 ? "Booking name — auto-filled" : "Booking name"}
            required
            htmlFor="booking-title"
          >
            <Input
              id="booking-title"
              name="booking-title"
              value={form.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
              placeholder={form.tieToEvent ? "Select an event above\u2026" : "e.g. Game day equipment"}
              required
            />
          </FormRow>

          {/* Sport (when not tied to event) */}
          {!form.tieToEvent && (
            <FormRow label="Sport" htmlFor="booking-sport-trigger">
              <Select
                name="booking-sport"
                value={form.sport || "__none__"}
                onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__none__" ? "" : v })}
              >
                <SelectTrigger id="booking-sport-trigger">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          )}

          {/* Requester + Location (2-col on sm+) */}
          <FormRow2Col label="Owner / location" required>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-requester-trigger" className="text-xs text-muted-foreground">{config.requesterLabel}</Label>
              <Select
                name="booking-requester"
                value={form.requester}
                onValueChange={(v) => dispatch({ type: "SET_REQUESTER", value: v })}
                required
              >
                <SelectTrigger id="booking-requester-trigger">
                  <SelectValue placeholder="Select\u2026" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-location-trigger" className="text-xs text-muted-foreground">Location</Label>
              <Select
                name="booking-location"
                value={form.locationId}
                onValueChange={(v) => dispatch({ type: "SET_LOCATION_ID", value: v })}
                required
              >
                <SelectTrigger id="booking-location-trigger">
                  <SelectValue placeholder="Select\u2026" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormRow2Col>

          {/* Kit (optional) */}
          {kits.length > 0 && (
            <FormRow label="Kit" htmlFor="booking-kit-trigger">
              <Select
                name="booking-kit"
                value={kitId || "__none__"}
                onValueChange={(v) => setKitId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="booking-kit-trigger">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {kits.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          )}

          {/* Dates (2-col) */}
          <FormRow2Col label={`${config.startLabel} / ${config.endLabel}`} required>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-starts-at" className="text-xs text-muted-foreground">{config.startLabel}</Label>
              <DateTimePicker
                id="booking-starts-at"
                value={form.startsAt ? new Date(form.startsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_STARTS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="Start date & time"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-ends-at" className="text-xs text-muted-foreground">{config.endLabel}</Label>
              <DateTimePicker
                id="booking-ends-at"
                value={form.endsAt ? new Date(form.endsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_ENDS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="End date & time"
              />
            </div>
          </FormRow2Col>

          {/* Notes (optional) */}
          <FormRow label="Notes" htmlFor="booking-notes">
            <Textarea
              id="booking-notes"
              name="booking-notes"
              value={form.notes}
              onChange={(e) => dispatch({ type: "SET_NOTES", value: e.target.value })}
              placeholder="Anything pickup or return crew should know — e.g. “VIP setup”, “Return by 6pm”"
              rows={3}
              maxLength={10000}
            />
          </FormRow>
        </div>
      </section>

    </div>
  );
}
