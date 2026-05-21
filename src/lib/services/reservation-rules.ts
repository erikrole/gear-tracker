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

export function normalizeReservationRules(raw: unknown): ReservationRules {
  if (!raw || typeof raw !== "object") return DEFAULT_RESERVATION_RULES;
  const r = raw as Record<string, unknown>;
  return {
    advanceWindowDays: typeof r.advanceWindowDays === "number" && r.advanceWindowDays > 0
      ? Math.round(r.advanceWindowDays) : null,
    noShowExpiryHours: typeof r.noShowExpiryHours === "number" && r.noShowExpiryHours > 0
      ? r.noShowExpiryHours : DEFAULT_RESERVATION_RULES.noShowExpiryHours,
    maxConcurrentReservations: typeof r.maxConcurrentReservations === "number" && r.maxConcurrentReservations > 0
      ? Math.round(r.maxConcurrentReservations) : null,
  };
}

export async function loadReservationRules(): Promise<ReservationRules> {
  const row = await db.systemConfig.findUnique({ where: { key: "reservation_rules" } });
  return normalizeReservationRules(row?.value);
}
