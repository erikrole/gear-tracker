import { z } from "zod";

export const profilePhoneSchema = z.string()
  .trim()
  .max(18)
  .refine(
    (value) => normalizedPhoneDigits(value).length === 10,
    "Enter a 10-digit phone number",
  );

export const nullableProfilePhoneSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  profilePhoneSchema.nullable().optional(),
);

export function normalizeProfilePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = normalizedPhoneDigits(value);
  return digits.length === 10 ? formatPhoneDigits(digits) : null;
}

function normalizedPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function formatPhoneDigits(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function formatPhoneInput(value: string): string {
  const digits = normalizedPhoneDigits(value).slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return formatPhoneDigits(digits);
}

export function phoneAuditValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : null;
}
