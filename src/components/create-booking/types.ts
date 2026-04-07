"use client";

import type { CalendarEvent } from "../booking-list/types";

/* ───── Form reducer types (shared across hooks & sub-components) ───── */

export type FormState = {
  tieToEvent: boolean;
  sport: string;
  selectedEvent: CalendarEvent | null;
  title: string;
  requester: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
};

export type FormAction =
  | { type: "SET_TIE_TO_EVENT"; value: boolean }
  | { type: "SET_SPORT"; value: string }
  | { type: "SELECT_EVENT"; event: CalendarEvent; title: string; startsAt: string; endsAt: string; locationId?: string }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_REQUESTER"; value: string }
  | { type: "SET_LOCATION_ID"; value: string }
  | { type: "SET_STARTS_AT"; value: string }
  | { type: "SET_ENDS_AT"; value: string }
  | { type: "RESET"; defaults: Partial<FormState> }
  | { type: "LOAD_DRAFT"; draft: Partial<FormState> };

export type Section = "event" | "details" | "equipment";

export type ShiftInfo = {
  area: string;
  startsAt: string;
  endsAt: string;
  gearStatus: string;
};
