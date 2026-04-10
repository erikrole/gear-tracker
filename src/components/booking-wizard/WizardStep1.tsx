"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClockIcon, BoxesIcon, CheckIcon } from "lucide-react";
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
      {children}
    </span>
  );
}

function SectionHeader({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span
        className="h-[18px] w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: "var(--wi-red)" }}
      />
      <h2
        className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground flex-1"
      >
        {children}
      </h2>
      {right}
    </div>
  );
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
  selectEvent,
}: Props) {
  return (
    <div className="space-y-10">

      {/* ═══ Event Section ═══ */}
      <section>
        <SectionHeader
          right={
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: !form.tieToEvent })}
              className={[
                "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                form.tieToEvent ? "" : "bg-muted",
              ].join(" ")}
              style={form.tieToEvent ? { backgroundColor: "var(--wi-red)" } : undefined}
              aria-label="Link to event"
              aria-pressed={form.tieToEvent}
            >
              <span
                className={[
                  "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                  form.tieToEvent ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          }
        >
          Link to Event
        </SectionHeader>

        {form.tieToEvent && (
          <div className="space-y-4">
            {/* Sport filter */}
            <div>
              <FieldLabel>Filter by sport</FieldLabel>
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
                      {s.code} \u2014 {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Events list */}
            <div>
              <FieldLabel>
                Upcoming events — next 3 days{form.sport ? ` \u00b7 ${sportLabel(form.sport)}` : ""}
              </FieldLabel>

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
                <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto border border-border rounded-sm p-1">
                  {events.map((ev) => {
                    const selected = form.selectedEvent?.id === ev.id;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => selectEvent(ev)}
                        className={[
                          "group flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left transition-all max-md:min-h-[44px]",
                          selected ? "text-white" : "hover:bg-muted/60",
                        ].join(" ")}
                        style={selected ? { backgroundColor: "var(--wi-red)" } : undefined}
                      >
                        {/* Sport code chip */}
                        {ev.sportCode && (
                          <span
                            className={[
                              "shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[2px]",
                              selected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            {ev.sportCode}
                          </span>
                        )}

                        {/* Match info */}
                        <div className="min-w-0 flex-1">
                          <div
                            className={[
                              "text-sm font-semibold truncate",
                              selected ? "text-white" : "text-foreground",
                            ].join(" ")}
                          >
                            {ev.opponent ? (
                              <>
                                <span className="font-normal opacity-70">{ev.isHome === false ? "at " : "vs "}</span>
                                {ev.opponent}
                              </>
                            ) : (
                              ev.summary
                            )}
                          </div>
                          <div
                            className={[
                              "text-xs mt-0.5 truncate",
                              selected ? "text-white/70" : "text-muted-foreground",
                            ].join(" ")}
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
                          <CheckIcon className="size-4 shrink-0 text-white ml-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shift context banner */}
        {myShiftForEvent && form.selectedEvent && (
          <div
            className="flex items-center gap-3 mt-4 px-3 py-2.5 rounded-r-sm bg-muted/40 border-l-[3px]"
            style={{ borderLeftColor: "var(--wi-red)" }}
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
      <section>
        <SectionHeader>Booking Details</SectionHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <FieldLabel>
              Booking name{form.tieToEvent && form.selectedEvent ? " \u2014 auto-filled from event" : ""}
            </FieldLabel>
            <Input
              value={form.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
              placeholder={form.tieToEvent ? "Select an event above\u2026" : "e.g. Game day equipment"}
              required
            />
          </div>

          {/* Sport (when not tied to event) */}
          {!form.tieToEvent && (
            <div>
              <FieldLabel>Sport (optional)</FieldLabel>
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
                      {s.code} \u2014 {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Requester + Location (2-col on sm+) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>{config.requesterLabel}</FieldLabel>
              <Select
                value={form.requester}
                onValueChange={(v) => dispatch({ type: "SET_REQUESTER", value: v })}
                required
              >
                <SelectTrigger>
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

            <div>
              <FieldLabel>Location</FieldLabel>
              <Select
                value={form.locationId}
                onValueChange={(v) => dispatch({ type: "SET_LOCATION_ID", value: v })}
                required
              >
                <SelectTrigger>
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
          </div>

          {/* Kit (optional) */}
          {kits.length > 0 && (
            <div>
              <FieldLabel>
                <span className="inline-flex items-center gap-1.5">
                  <BoxesIcon className="size-3" />
                  Kit (optional)
                </span>
              </FieldLabel>
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

          {/* Dates (2-col) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>{config.startLabel}</FieldLabel>
              <DateTimePicker
                value={form.startsAt ? new Date(form.startsAt) : undefined}
                onChange={(d) => dispatch({ type: "SET_STARTS_AT", value: toLocalDateTimeValue(d) })}
                placeholder="Start date & time"
              />
            </div>
            <div>
              <FieldLabel>{config.endLabel}</FieldLabel>
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
