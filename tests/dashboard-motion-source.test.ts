import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dashboard motion contracts", () => {
  it("keeps state transitions short, interruptible, and reduced-motion aware", () => {
    const motion = readFileSync("src/app/(app)/dashboard/dashboard-motion.tsx", "utf8");

    expect(motion).toContain("useReducedMotion");
    expect(motion).toContain("duration: reduceMotion ? 0.12 : 0.2");
    expect(motion).toContain("duration: 0.12");
    expect(motion).toContain("scale: 0.98");
    expect(motion).toContain("y: 4");
    expect(motion).toContain("forwardRef<HTMLDivElement");
  });

  it("crossfades resolved dashboard and collaborator states without replaying initial motion", () => {
    const page = readFileSync("src/app/(app)/page.tsx", "utf8");
    const collaborator = readFileSync("src/app/(app)/dashboard/collaborator-home.tsx", "utf8");

    expect(page).toContain('<AnimatePresence initial={false} mode="popLayout">');
    expect(page).toContain('key="dashboard-columns-loading"');
    expect(page).toContain('key="dashboard-columns"');
    expect(collaborator).toContain('<AnimatePresence initial={false} mode="popLayout">');
    expect(collaborator).toContain('key="collaborator-loading"');
    expect(collaborator).toContain('key="collaborator-content"');
  });

  it("animates optimistic draft recovery and transient exception surfaces symmetrically", () => {
    const page = readFileSync("src/app/(app)/page.tsx", "utf8");
    const myGear = readFileSync("src/app/(app)/dashboard/my-gear-column.tsx", "utf8");
    const team = readFileSync("src/app/(app)/dashboard/team-activity-column.tsx", "utf8");
    const overdue = readFileSync("src/app/(app)/dashboard/overdue-banner.tsx", "utf8");
    const flagged = readFileSync("src/app/(app)/dashboard/flagged-items-banner.tsx", "utf8");
    const lost = readFileSync("src/app/(app)/dashboard/lost-bulk-units-card.tsx", "utf8");

    expect(page).toContain('key="overdue"');
    expect(page).toContain('key="flagged-items"');
    expect(page).toContain('key="lost-bulk-units"');
    expect(myGear).toContain('<AnimatePresence initial={false}>');
    expect(myGear).toContain('key="drafts"');
    expect(team).toContain('key="pending-pickups"');
    expect(team).toContain('key="stale-reservations"');
    expect(overdue).not.toContain("dash-fade-up");
    expect(flagged).not.toContain("dash-fade-up");
    expect(lost).not.toContain("dash-fade-up");
  });
});
