import type { BadgeScanErrorCode, BadgeScanPhase } from "./types";

export function normalizeBadgeScanValue(scanValue: string) {
  return scanValue.trim().toLowerCase();
}

export function badgeScanSourceKey(args: {
  phase: BadgeScanPhase;
  userId?: string;
  bookingId?: string;
  scanValue: string;
  ok: boolean;
  errorCode?: BadgeScanErrorCode;
}) {
  const owner = args.bookingId ?? args.userId ?? "unknown";
  const outcome = args.ok ? "ok" : args.errorCode ?? "unknown";
  return `${args.phase}:${owner}:${normalizeBadgeScanValue(args.scanValue)}:${outcome}`;
}

export function badgeScanErrorCode(message: string): BadgeScanErrorCode {
  const normalized = message.toLowerCase();

  if (normalized.includes("not found") || normalized.includes("does not exist")) {
    return "not_found";
  }
  if (normalized.includes("not in this checkout") || normalized.includes("not in this pickup")) {
    return "not_in_booking";
  }
  if (normalized.includes("already scanned")) {
    return "duplicate";
  }
  if (normalized.includes("already returned")) {
    return "already_returned";
  }
  if (normalized.includes("not checked out")) {
    return "not_checked_out";
  }
  if (normalized.includes("checked out")) {
    return "already_checked_out";
  }
  if (normalized.includes("retired")) {
    return "retired";
  }
  if (
    normalized.includes("state") ||
    normalized.includes("status") ||
    normalized.includes("maintenance") ||
    normalized.includes("marked")
  ) {
    return "wrong_status";
  }
  if (normalized.includes("wrong battery type")) {
    return "not_in_booking";
  }
  if (normalized.includes("has ") && normalized.includes("units scanned")) {
    return "quantity_exceeded";
  }

  return "unknown";
}
