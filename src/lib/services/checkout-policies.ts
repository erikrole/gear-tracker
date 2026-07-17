import { db } from "@/lib/db";

export type CheckoutPolicies = {
  defaultLoanDays: number;
  gracePeriodHours: number;
  maxItemsPerUser: number | null;
};

export const DEFAULT_CHECKOUT_POLICIES: CheckoutPolicies = {
  defaultLoanDays: 3,
  gracePeriodHours: 0,
  maxItemsPerUser: null,
};

function normalizeBoundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

export function normalizeCheckoutPolicies(raw: unknown): CheckoutPolicies {
  if (!raw || typeof raw !== "object") return DEFAULT_CHECKOUT_POLICIES;
  const r = raw as Record<string, unknown>;
  const defaultLoanDays = normalizeBoundedInteger(r.defaultLoanDays, 1, 365);
  return {
    defaultLoanDays: defaultLoanDays ?? DEFAULT_CHECKOUT_POLICIES.defaultLoanDays,
    gracePeriodHours: typeof r.gracePeriodHours === "number"
      && Number.isFinite(r.gracePeriodHours)
      && r.gracePeriodHours >= 0
      && r.gracePeriodHours <= 168
      ? r.gracePeriodHours : DEFAULT_CHECKOUT_POLICIES.gracePeriodHours,
    maxItemsPerUser: normalizeBoundedInteger(r.maxItemsPerUser, 1, 100),
  };
}

export async function loadCheckoutPolicies(): Promise<CheckoutPolicies> {
  const row = await db.systemConfig.findUnique({ where: { key: "checkout_policies" } });
  return normalizeCheckoutPolicies(row?.value);
}
