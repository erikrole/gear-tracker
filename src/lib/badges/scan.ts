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
