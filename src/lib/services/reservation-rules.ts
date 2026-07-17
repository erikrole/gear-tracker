import { db } from "@/lib/db";

export type ReservationRules = {
  advanceWindowDays: number | null;
  noShowExpiryHours: number;
  maxConcurrentReservations: number | null;
};

export const DEFAULT_RESERVATION_RULES: ReservationRules = {
  advanceWindowDays: null,
  noShowExpiryHours: 48,
  maxConcurrentReservations: null,
};

function normalizeRoundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

function normalizeBoundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function normalizeReservationRules(raw: unknown): ReservationRules {
  if (!raw || typeof raw !== "object") return DEFAULT_RESERVATION_RULES;
  const r = raw as Record<string, unknown>;
  return {
    advanceWindowDays: normalizeRoundedInteger(r.advanceWindowDays, 1, 730),
    noShowExpiryHours: normalizeBoundedNumber(
      r.noShowExpiryHours,
      1,
      336,
      DEFAULT_RESERVATION_RULES.noShowExpiryHours,
    ),
    maxConcurrentReservations: normalizeRoundedInteger(r.maxConcurrentReservations, 1, 50),
  };
}

export async function loadReservationRules(): Promise<ReservationRules> {
  const row = await db.systemConfig.findUnique({ where: { key: "reservation_rules" } });
  return normalizeReservationRules(row?.value);
}
