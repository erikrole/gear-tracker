import { HttpError } from "@/lib/http";

export function parseDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(400, "Invalid startsAt or endsAt");
  }

  if (end <= start) {
    throw new HttpError(400, "endsAt must be later than startsAt");
  }

  return { start, end };
}
