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

export function normalizeCheckoutPolicies(raw: unknown): CheckoutPolicies {
  if (!raw || typeof raw !== "object") return DEFAULT_CHECKOUT_POLICIES;
  const r = raw as Record<string, unknown>;
  return {
    defaultLoanDays: typeof r.defaultLoanDays === "number" && r.defaultLoanDays > 0
      ? Math.round(r.defaultLoanDays) : DEFAULT_CHECKOUT_POLICIES.defaultLoanDays,
    gracePeriodHours: typeof r.gracePeriodHours === "number" && r.gracePeriodHours >= 0
      ? r.gracePeriodHours : DEFAULT_CHECKOUT_POLICIES.gracePeriodHours,
    maxItemsPerUser: typeof r.maxItemsPerUser === "number" && r.maxItemsPerUser > 0
      ? Math.round(r.maxItemsPerUser) : null,
  };
}

export async function loadCheckoutPolicies(): Promise<CheckoutPolicies> {
  const row = await db.systemConfig.findUnique({ where: { key: "checkout_policies" } });
  return normalizeCheckoutPolicies(row?.value);
}
