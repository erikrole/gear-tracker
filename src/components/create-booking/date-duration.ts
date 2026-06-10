import { toLocalDateTimeValue } from "@/components/booking-list/types";

type DateWindow = {
  startsAt: string;
  endsAt: string;
};

function parseDateTimeValue(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function applyDurationPreservingStartChange<T extends DateWindow>(
  state: T,
  startsAt: string,
): T {
  const previousStart = parseDateTimeValue(state.startsAt);
  const previousEnd = parseDateTimeValue(state.endsAt);
  const nextStart = parseDateTimeValue(startsAt);

  if (!previousStart || !previousEnd || !nextStart) {
    return { ...state, startsAt };
  }

  const durationMs = previousEnd.getTime() - previousStart.getTime();
  if (durationMs <= 0) {
    return { ...state, startsAt };
  }

  return {
    ...state,
    startsAt,
    endsAt: toLocalDateTimeValue(new Date(nextStart.getTime() + durationMs)),
  };
}
