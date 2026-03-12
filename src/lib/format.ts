/* ── Shared formatting helpers (client-safe) ──────────────── */

// ── Urgency / countdown ──────────────────────────────────

export type UrgencyLevel = "overdue" | "critical" | "warning" | "normal";

export function getUrgency(startsAt: string, endsAt: string, now: Date): UrgencyLevel {
  const end = new Date(endsAt).getTime();
  const remaining = end - now.getTime();
  if (remaining <= 0) return "overdue";

  const duration = end - new Date(startsAt).getTime();
  if (duration <= 0) return "critical";

  const pctRemaining = remaining / duration;
  if (pctRemaining <= 0.10) return "critical";
  if (pctRemaining <= 0.25) return "warning";
  return "normal";
}

export function formatCountdown(endsAt: string, now: Date): string {
  const diff = new Date(endsAt).getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((absDiff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((absDiff % (60 * 60 * 1000)) / (60 * 1000));

  let timeStr: string;
  if (days > 0) {
    timeStr = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else {
    timeStr = `${minutes}m`;
  }

  if (diff <= 0) return `OVERDUE BY ${timeStr}`;
  return `DUE BACK IN ${timeStr}`;
}

// ── Date formatting ──────────────────────────────────────

/** "Mar 11" */
export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "Mar 11, 2026" */
export function formatDateFull(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Mar 11, 2026, 3:00 PM" */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact overdue elapsed: "3d" or "5h" or "12m" */
export function formatOverdueElapsed(endsAt: string, now: Date): string {
  const diff = now.getTime() - new Date(endsAt).getTime();
  if (diff <= 0) return "";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d overdue`;
  if (hours > 0) return `${hours}h overdue`;
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${minutes}m overdue`;
}

/** Check if endsAt falls on today */
export function isDueToday(endsAt: string, now: Date): boolean {
  const end = new Date(endsAt);
  return end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate();
}

/** "Mar 11 – Mar 14" or "Mar 11" if same day */
export function formatDateRange(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString("en-US", opts);
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}
