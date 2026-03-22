import { HttpError } from "@/lib/http";

/** Clock-skew tolerance: allow dates up to 15 minutes in the past */
const SKEW_MS = 15 * 60 * 1000;

export function parseDateRange(
  startsAt: string,
  endsAt: string,
  { requireFutureStart = false }: { requireFutureStart?: boolean } = {},
) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(400, "Invalid startsAt or endsAt");
  }

  if (end <= start) {
    throw new HttpError(400, "endsAt must be later than startsAt");
  }

  if (requireFutureStart && start.getTime() < Date.now() - SKEW_MS) {
    throw new HttpError(400, "Start date must not be in the past");
  }

  return { start, end };
}
