"use client";

import type { Dispatch } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, ClockIcon, CalendarIcon } from "lucide-react";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { formatDate, type CalendarEvent } from "../booking-list/types";
import type { FormAction, Section, ShiftInfo } from "./types";

export type EventSectionProps = {
  tieToEvent: boolean;
  sport: string;
  selectedEvent: CalendarEvent | null;
  events: CalendarEvent[];
  eventsLoading: boolean;
  myShiftForEvent: ShiftInfo | null;
  openSection: Section;
  eventSummary: React.ReactNode;
  dispatch: Dispatch<FormAction>;
  selectEvent: (ev: CalendarEvent) => void;
  toggleSection: (section: Section) => void;
};

export function EventSection({
  tieToEvent,
  sport,
  selectedEvent,
  events,
  eventsLoading,
  myShiftForEvent,
  openSection,
  eventSummary,
  dispatch,
  selectEvent,
  toggleSection,
}: EventSectionProps) {
  return (
    <Collapsible open={openSection === "event"} onOpenChange={() => toggleSection("event")}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 border-b px-6 py-3 text-left hover:bg-muted/50 transition-colors"
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
            <span className="font-medium text-sm">Event</span>
            {openSection !== "event" && eventSummary}
          </div>
          {openSection === "event" ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-b px-6 py-4">
          {/* Tie to event toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`toggle ${tieToEvent ? "on" : ""}`}
              onClick={() => dispatch({ type: "SET_TIE_TO_EVENT", value: !tieToEvent })}
              aria-label="Tie to event"
            />
            <span className="text-sm">Link to event</span>
          </div>

          {/* Sport + event list */}
          {tieToEvent && (
            <>
              <div className="space-y-1">
                <Label>Sport</Label>
                <Select value={sport} onValueChange={(v) => dispatch({ type: "SET_SPORT", value: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORT_CODES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} - {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {sport && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Upcoming events (next 30 days)</Label>
                  {eventsLoading ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Loading events...</div>
                  ) : events.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      No upcoming events for {sportLabel(sport)}. Toggle off &ldquo;Link to event&rdquo; to
                      create without an event.
                    </div>
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                      {events.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            selectedEvent?.id === ev.id
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => selectEvent(ev)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {ev.opponent ? `${ev.isHome ? "vs" : "at"} ${ev.opponent}` : ev.summary}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {formatDate(ev.startsAt)}
                              {ev.rawLocationText ? ` \u00b7 ${ev.rawLocationText}` : ""}
                              {ev.location ? ` \u00b7 ${ev.location.name}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {ev.isHome !== null && (
                              <Badge variant="gray" size="sm">
                                {ev.isHome ? "HOME" : "AWAY"}
                              </Badge>
                            )}
                            {ev.sportCode && (
                              <Badge variant="sport" size="sm">
                                {ev.sportCode}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Shift context banner */}
          {myShiftForEvent && selectedEvent && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
