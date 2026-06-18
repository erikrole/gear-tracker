import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("schedule queue source contract", () => {
  it("keeps schedule queue state URL-backed", () => {
    const hook = source("src/hooks/use-schedule-data.ts");

    expect(hook).toContain('searchParams.get("queue")');
    expect(hook).toContain('params.set("queue", queue)');
    expect(hook).toContain('params.delete("queue")');
    expect(hook).toContain("router.replace");
    expect(hook).toContain("filterEntriesForScheduleQueue");
  });

  it("routes readiness cards into named queues", () => {
    const readiness = source("src/app/(app)/schedule/_components/ScheduleReadiness.tsx");

    for (const queue of [
      "needs-staffing",
      "my-calls-today",
      "trade-approval",
      "pending-requests",
      "conflicts",
      "gear-gaps",
      "stale-source",
    ]) {
      expect(readiness).toContain(`"${queue}"`);
    }
  });

  it("opens trade approval through claimed trades instead of a generic board", () => {
    const page = source("src/app/(app)/schedule/page.tsx");
    const tradeBoard = source("src/components/TradeBoard.tsx");

    expect(page).toContain('queue === "trade-approval"');
    expect(page).toContain('initialStatusFilter={data.filters.queue === "trade-approval" ? "CLAIMED" : undefined}');
    expect(tradeBoard).toContain("initialStatusFilter");
    expect(tradeBoard).toContain("setStatusFilter(initialStatusFilter)");
  });
});
