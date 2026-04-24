"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { generateEventTitle } from "@/lib/sports";
import { toast } from "sonner";
import {
  toLocalDateTimeValue,
  type CalendarEvent,
} from "../booking-list/types";
import type { FormAction } from "./types";

const MAX_SELECTED_EVENTS = 3;

/** Derive auto-fill fields from the chronologically-first event in the list. */
function deriveFromPrimary(events: CalendarEvent[], sport: string) {
  if (events.length === 0) return {};
  const primary = events[0];
  const title = generateEventTitle(primary.sportCode || sport, primary.opponent, primary.isHome);
  const start = new Date(new Date(primary.startsAt).getTime() - 2 * 60 * 60 * 1000);
  // endsAt derives from the LAST event — multi-event span covers the whole window.
  const last = events[events.length - 1];
  const returnBuffer = last.isHome === false ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
  const end = new Date(new Date(last.endsAt).getTime() + returnBuffer);
  return {
    title,
    startsAt: toLocalDateTimeValue(start),
    endsAt: toLocalDateTimeValue(end),
    locationId: primary.location?.id,
  };
}

export function useEventContext({
  sport,
  tieToEvent,
  open,
  selectedEvents,
  initialEventId,
  dispatch,
}: {
  sport: string;
  tieToEvent: boolean;
  open: boolean;
  selectedEvents: CalendarEvent[];
  initialEventId?: string;
  dispatch: Dispatch<FormAction>;
}) {

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [myShiftForEvent, setMyShiftForEvent] = useState<{
    area: string;
    startsAt: string;
    endsAt: string;
    gearStatus: string;
  } | null>(null);
  const autoSelectedEventRef = useRef(false);

  // ── Fetch events (all sports by default, filtered when sport selected) ──
  useEffect(() => {
    if (!tieToEvent || !open) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    const controller = new AbortController();
    const now = new Date();
    const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      startDate: now.toISOString(),
      endDate: in3.toISOString(),
      limit: "30",
    });
    if (sport) params.set("sportCode", sport);
    fetch(`/api/calendar-events?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        setEvents(json?.data || []);
        setEventsLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setEventsLoading(false);
          toast.error("Couldn’t load events — try again");
        }
      });
    return () => controller.abort();
  }, [sport, tieToEvent, open]);

  // ── Toggle an event in/out of the selection, enforcing cap and chronological order ──
  const toggleEvent = useCallback(
    (ev: CalendarEvent): { ok: boolean; reason?: string } => {
      const isSelected = selectedEvents.some((e) => e.id === ev.id);
      let next: CalendarEvent[];
      if (isSelected) {
        next = selectedEvents.filter((e) => e.id !== ev.id);
      } else {
        if (selectedEvents.length >= MAX_SELECTED_EVENTS) {
          toast.error(`You can link at most ${MAX_SELECTED_EVENTS} events to a booking`);
          return { ok: false, reason: "cap" };
        }
        next = [...selectedEvents, ev].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        );
      }
      dispatch({
        type: "SET_SELECTED_EVENTS",
        events: next,
        ...deriveFromPrimary(next, sport),
      });
      return { ok: true };
    },
    [selectedEvents, sport, dispatch],
  );

  // ── Auto-select event when initialEventId matches a loaded event (URL deep link, single-event V0 compat) ──
  useEffect(() => {
    if (!initialEventId || autoSelectedEventRef.current || events.length === 0) return;
    const match = events.find((e) => e.id === initialEventId);
    if (match) {
      autoSelectedEventRef.current = true;
      toggleEvent(match);
    }
  }, [events, initialEventId, toggleEvent]);

  // ── Fetch shift context for the PRIMARY (first) selected event ──
  useEffect(() => {
    const primary = selectedEvents[0];
    if (!primary) {
      setMyShiftForEvent(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/my-shifts?eventId=${primary.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const shifts = json?.data;
        if (shifts?.length > 0) {
          const s = shifts[0];
          setMyShiftForEvent({ area: s.area, startsAt: s.startsAt, endsAt: s.endsAt, gearStatus: s.gear.status });
        } else {
          setMyShiftForEvent(null);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setMyShiftForEvent(null);
      });
    return () => controller.abort();
  // Primary id is what matters — track it explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvents[0]?.id]);

  return { events, eventsLoading, myShiftForEvent, toggleEvent };
}
