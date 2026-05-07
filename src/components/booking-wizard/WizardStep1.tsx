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
import { ClockIcon, CheckIcon, XIcon } from "lucide-react";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { formatChipTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormRow, FormRow2Col, SectionHeading } from "@/components/form-layout";
import {
  toLocalDateTimeValue,
  formatDate,
  type FormUser,
  type Location,
  type CalendarEvent,
} from "@/components/booking-list/types";
import { MAX_SCROLL_HEIGHT } from "./constants";
import type { FormState, FormAction, ShiftInfo } from "@/components/create-booking/types";

type WizardConfig = {
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
  return (
    <div className="flex flex-col gap-10">

      {/* ═══ Event Section ═══ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Event context</SectionHeading>
          <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-3">
            <Switch
              id="booking-link-to-event"
              checked={form.tieToEvent}
              onCheckedChange={(value) => dispatch({ type: "SET_TIE_TO_EVENT", value })}
            />
            <Label htmlFor="booking-link-to-event" className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground">
              Link to event
            </Label>
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
                      {formatChipTime(ev.startsAt)}
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
                <div className="border border-dashed rounded-sm p-4 text-sm text-muted-foreground leading-relaxed">
                  No upcoming events{form.sport ? ` for ${sportLabel(form.sport)}` : ""}. Toggle off
                  &ldquo;Link to event&rdquo; to create without an event.
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
                            {formatDate(ev.startsAt)}
                            {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                            {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                          </div>
                        </div>

                        {/* Home/Away/Neutral badge */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {ev.isHome === true && (
                            <Badge variant="green" size="sm">Home</Badge>
                          )}
                          {ev.isHome === false && (
                            <Badge variant="red" size="sm">Away</Badge>
                          )}
                          {ev.isHome === null && ev.opponent && (
                            <Badge variant="blue" size="sm">Neutral</Badge>
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
