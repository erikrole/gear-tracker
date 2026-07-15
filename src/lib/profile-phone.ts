import { z } from "zod";

export const profilePhoneSchema = z.string()
  .trim()
  .max(30)
  .refine(
    (value) => value.replace(/\D/g, "").length >= 7,
    "Enter a phone number with at least 7 digits",
  );

export const nullableProfilePhoneSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  profilePhoneSchema.nullable().optional(),
);

export function normalizeProfilePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}

export function phoneAuditValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : null;
}
