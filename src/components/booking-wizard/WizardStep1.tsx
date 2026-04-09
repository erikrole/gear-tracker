"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ClockIcon, BoxesIcon } from "lucide-react";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import {
  toLocalDateTimeValue,
  formatDate,
  type FormUser,
  type Location,
  type CalendarEvent,
} from "@/components/booking-list/types";
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
  selectEvent: (ev: CalendarEvent) => void;
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
  selectEvent,
}: Props) {
  return (
    <div className="space-y-8">
      {/* ═══ Event Section ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Event</h2>
        </div>

        {/* Tie to event toggle */}
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            className={`toggle ${form.tieToEvent ? "on" : ""}`}
            onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: !form.tieToEvent })}
            aria-label="Link to event"
          />
          <span className="text-sm">Link to event</span>
        </div>

        {/* Event list with optional sport filter */}
        {form.tieToEvent && (
          <div className="space-y-3">
            {/* Sport filter (optional — narrows the event list) */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Filter by sport</Label>
              <Select
                value={form.sport || "__all__"}
                onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__all__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sports</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                Events — next 3 days{form.sport ? ` · ${sportLabel(form.sport)}` : ""}
              </Label>
              {eventsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No upcoming events{form.sport ? ` for ${sportLabel(form.sport)}` : ""}. Toggle off &ldquo;Link to event&rdquo; to
                  create without an event.
                </div>
              ) : (
                <div className="max-h-64 flex flex-col gap-1 overflow-y-auto rounded-md border p-1">
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors max-md:min-h-[44px] ${
                        form.selectedEvent?.id === ev.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => selectEvent(ev)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {ev.opponent ? `${ev.isHome === false ? "at" : "vs"} ${ev.opponent}` : ev.summary}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatDate(ev.startsAt)}
                          {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                          {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {ev.isHome === true && <Badge variant="gray" size="sm">HOME</Badge>}
                        {ev.isHome === false && <Badge variant="gray" size="sm">AWAY</Badge>}
                        {ev.isHome === null && ev.opponent && <Badge variant="gray" size="sm">NEUTRAL</Badge>}
                        {ev.sportCode && <Badge variant="sport" size="sm">{ev.sportCode}</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shift context banner */}
        {myShiftForEvent && form.selectedEvent && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm mt-3">
            <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <span className="font-medium">Your shift</span>
              <span className="text-muted-foreground">
                {" "}
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

      {/* ═══ Details Section ═══ */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Booking Details</h2>

        <div className="space-y-3">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <Label>
              Booking name{form.tieToEvent && form.selectedEvent ? " (auto-filled from event)" : ""}
            </Label>
            <Input
              value={form.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
              placeholder={form.tieToEvent ? "Select an event above..." : "e.g. Game day equipment"}
              required
            />
          </div>

          {/* Sport (when not tied to event) */}
          {!form.tieToEvent && (
            <div className="flex flex-col gap-1">
              <Label>Sport (optional)</Label>
              <Select
                value={form.sport || "__none__"}
                onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {SPORT_CODES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Requester */}
          <div className="flex flex-col gap-1">
            <Label>{config.requesterLabel}</Label>
            <Select value={form.requester} onValueChange={(v) => dispatch({ type: "SET_REQUESTER", value: v })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
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

          {/* Location */}
          <div className="flex flex-col gap-1">
            <Label>Pickup Location</Label>
            <Select
              value={form.locationId}
              onValueChange={(v) => dispatch({ type: "SET_LOCATION_ID", value: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
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

          {/* Kit (optional) */}
          {kits.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="flex items-center gap-1.5">
                <BoxesIcon className="size-3.5" />
                Kit (optional)
              </Label>
              <Select
                value={kitId || "__none__"}
                onValueChange={(v) => setKitId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
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
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>{config.startLabel}</Label>
              <DateTimePicker
                value={form.startsAt ? new Date(form.startsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_STARTS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="Start date & time"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{config.endLabel}</Label>
              <DateTimePicker
                value={form.endsAt ? new Date(form.endsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_ENDS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="End date & time"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
