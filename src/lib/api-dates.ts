import { HttpError } from "@/lib/http";

export function parseOptionalDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date`);
  }
  return date;
}

export function assertDateOrder(
  start: Date | null,
  end: Date | null,
  label = "endDate must be after startDate",
  options: { allowEqual?: boolean } = {},
) {
  if (!start || !end) return;
  const allowEqual = options.allowEqual ?? true;
  const invalid = allowEqual ? end < start : end <= start;
  if (invalid) {
    throw new HttpError(400, label);
  }
}

/** Enforce that a call-time pair is always set together — never one without the other. */
export function assertCallTimePair(start: Date | null, end: Date | null) {
  if ((start === null) !== (end === null)) {
    throw new HttpError(400, "callStartsAt and callEndsAt must both be provided or both omitted");
  }
}
