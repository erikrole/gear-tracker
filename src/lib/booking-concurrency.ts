import { HttpError } from "@/lib/http";

const STALE_BOOKING_MESSAGE = "This booking was modified by someone else. Please refresh and try again.";

function secondPrecision(value: Date | string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.NaN;
  return Math.floor(timestamp / 1000) * 1000;
}

export function parseBookingSnapshotHeader(req: Request) {
  const value = req.headers.get("if-unmodified-since");
  if (!value) {
    throw new HttpError(428, "Missing If-Unmodified-Since header. Refresh and try again.");
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new HttpError(400, "Invalid If-Unmodified-Since header.");
  }
  return parsed;
}

export function bookingSnapshotMatches(current: Date | string, expected: Date) {
  return secondPrecision(current) === secondPrecision(expected);
}

export function assertBookingSnapshot(current: Date | string, expected?: Date) {
  if (expected && !bookingSnapshotMatches(current, expected)) {
    throw new HttpError(409, STALE_BOOKING_MESSAGE);
  }
}

export function staleBookingError() {
  return new HttpError(409, STALE_BOOKING_MESSAGE);
}
