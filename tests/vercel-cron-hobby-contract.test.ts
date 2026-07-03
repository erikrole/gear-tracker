import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CronEntry = {
  path: string;
  schedule: string;
};

function isSingleValue(field: string, min: number, max: number) {
  if (!/^\d+$/.test(field)) return false;
  const value = Number(field);
  return value >= min && value <= max;
}

function runsAtMostOncePerDay(schedule: string) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour] = parts;
  return isSingleValue(minute ?? "", 0, 59) && isSingleValue(hour ?? "", 0, 23);
}

describe("Vercel cron Hobby compatibility", () => {
  it("keeps scheduled cron expressions at daily-or-slower cadence", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: CronEntry[] };
    const invalid = (config.crons ?? []).filter((entry) => !runsAtMostOncePerDay(entry.schedule));

    expect(invalid).toEqual([]);
  });
});
