"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { generateEventTitle } from "@/lib/sports";
import { toast } from "sonner";
import {
  toLocalDateTimeValue,
  type CalendarEvent,
} from "../booking-list/types";
import type { FormAction } from "./types";

export function useEventContext({
  sport,
  tieToEvent,
  open,
  selectedEvent,
  initialEventId,
  dispatch,
}: {
  sport: string;
  tieToEvent: boolean;
  open: boolean;
  selectedEvent: CalendarEvent | null;
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
          toast.error("Couldn\u2019t load events \u2014 try again");
        }
      });
    return () => controller.abort();
  }, [sport, tieToEvent, open]);

  // ── Select an event and auto-populate form ──
  const selectEvent = useCallback(
    (ev: CalendarEvent) => {
      const title = generateEventTitle(ev.sportCode || sport, ev.opponent, ev.isHome);
      const start = new Date(new Date(ev.startsAt).getTime() - 2 * 60 * 60 * 1000);
      // Away events get +1 day return buffer for travel; home/neutral get +2 hours
      const returnBuffer = ev.isHome === false ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
      const end = new Date(new Date(ev.endsAt).getTime() + returnBuffer);
      dispatch({
        type: "SELECT_EVENT",
        event: ev,
        title,
        startsAt: toLocalDateTimeValue(start),
        endsAt: toLocalDateTimeValue(end),
        locationId: ev.location?.id,
      });
    },
    [sport, dispatch],
  );

  // ── Auto-select event when initialEventId matches a loaded event ──
  useEffect(() => {
    if (!initialEventId || autoSelectedEventRef.current || events.length === 0) return;
    const match = events.find((e) => e.id === initialEventId);
    if (match) {
      autoSelectedEventRef.current = true;
      selectEvent(match);
    }
  }, [events, initialEventId, selectEvent]);

  // ── Fetch shift context when event changes ──
  useEffect(() => {
    if (!selectedEvent) {
      setMyShiftForEvent(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/my-shifts?eventId=${selectedEvent.id}`, { signal: controller.signal })
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
  }, [selectedEvent]);

  return { events, eventsLoading, myShiftForEvent, selectEvent };
}
