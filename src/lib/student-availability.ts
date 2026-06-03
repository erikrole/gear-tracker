const TZ = process.env.INSTITUTION_TZ ?? "America/Chicago";

export type AvailabilityKind = "WEEKLY" | "AD_HOC";

export type AvailabilityBlockLike = {
  id?: string;
  userId?: string;
  kind?: AvailabilityKind | string | null;
  dayOfWeek?: number | null;
  date?: Date | string | null;
  startsAt: string;
  endsAt: string;
  label?: string | null;
  semesterLabel?: string | null;
  semesterStartsOn?: Date | string | null;
  semesterEndsOn?: Date | string | null;
};

export type AvailabilityWindow = {
  startsAt: Date;
  endsAt: Date;
};

export type AvailabilityConflict = {
  block: AvailabilityBlockLike;
  note: string;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toLocalParts(dt: Date): { dayOfWeek: number; date: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(dt);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const month = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");
  const year = get("year");
  const hour = get("hour").padStart(2, "0");
  const minute = get("minute").padStart(2, "0");

  return {
    dayOfWeek: WEEKDAY_MAP[weekday] ?? 1,
    date: `${year}-${month}-${day}`,
    hhmm: `${hour}:${minute}`,
  };
}

export function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export function timeOverlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

function isWithinDateBounds(localDate: string, block: AvailabilityBlockLike): boolean {
  const startsOn = dateOnly(block.semesterStartsOn);
  const endsOn = dateOnly(block.semesterEndsOn);
  if (startsOn && localDate < startsOn) return false;
  if (endsOn && localDate > endsOn) return false;
  return true;
}

function formatConflictNote(block: AvailabilityBlockLike): string {
  const label = block.label?.trim();
  const fallback = block.kind === "AD_HOC" ? "conflict" : "class";
  return label
    ? `Conflicts with ${label} (${block.startsAt}-${block.endsAt})`
    : `Conflicts with ${fallback} ${block.startsAt}-${block.endsAt}`;
}

export function findAvailabilityConflict(
  blocks: AvailabilityBlockLike[],
  window: AvailabilityWindow,
): AvailabilityConflict | null {
  const start = toLocalParts(window.startsAt);
  const end = toLocalParts(window.endsAt);

  for (const block of blocks) {
    if (!timeOverlaps(start.hhmm, end.hhmm, block.startsAt, block.endsAt)) continue;

    if (block.kind === "AD_HOC") {
      if (dateOnly(block.date) !== start.date) continue;
      return { block, note: formatConflictNote(block) };
    }

    if (block.dayOfWeek !== start.dayOfWeek) continue;
    if (!isWithinDateBounds(start.date, block)) continue;
    return { block, note: formatConflictNote(block) };
  }

  return null;
}

export function availabilityConflictNote(
  blocks: AvailabilityBlockLike[],
  window: AvailabilityWindow,
): string | null {
  return findAvailabilityConflict(blocks, window)?.note ?? null;
}
