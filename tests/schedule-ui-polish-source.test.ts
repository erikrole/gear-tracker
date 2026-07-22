import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Schedule interaction-detail contracts", () => {
  it("keeps primary and secondary Schedule commands on the 40px baseline", () => {
    const page = source("src/app/(app)/schedule/page.tsx");
    const calendar = source("src/app/(app)/schedule/_components/CalendarView.tsx");
    const list = source("src/app/(app)/schedule/_components/ListView.tsx");
    const sourceSignal = source("src/app/(app)/schedule/_components/ScheduleSourceSignal.tsx");

    expect(page).toContain('<Button size="sm" className="h-10" asChild>');
    expect(page).toContain('className="h-10" aria-label="More schedule actions"');
    expect(calendar).toContain('className="h-10" onClick={onSwitchToList}');
    expect(list).toContain('className="h-10" onClick={loadData}');
    expect(list).not.toContain('className="h-9 shrink-0 px-2 text-xs');
    expect(sourceSignal).toContain('className="h-10 w-fit"');
  });

  it("makes Schedule browse controls tactile and keyboard-visible", () => {
    const filters = source("src/app/(app)/schedule/_components/ScheduleFilters.tsx");
    const calendar = source("src/app/(app)/schedule/_components/CalendarView.tsx");
    const week = source("src/app/(app)/schedule/_components/WeekView.tsx");

    expect(filters).toContain('<Label\n          htmlFor="my-shifts-toggle"');
    expect(filters).not.toContain('className="scale-[0.8] origin-center"');
    expect(calendar).toContain("flex min-h-10 w-full items-center");
    expect(calendar).not.toContain('"text-foreground hover:bg-muted/60"');
    expect(week).toContain("transition-[background-color,opacity,scale] active:scale-[0.96]");
    expect(week).toContain("flex min-h-14 w-full items-center justify-between");
  });

  it("keeps crew avatars beside coverage and moves open-slot assignment into row actions", () => {
    const list = source("src/app/(app)/schedule/_components/ListView.tsx");

    expect(list).toContain("<span>Coverage</span>");
    expect(list).toContain('<span className="text-right">Crew</span>');
    expect(list).toContain("<CrewSummary entry={entry} />");
    expect(list).toContain("Assign {openCount} open {openCount === 1 ? \"slot\" : \"slots\"}");
    expect(list).not.toContain("onSelectGroup();\n          }}\n        >\n          Assign {openCount}");
  });

  it("keeps expanded crew actions quiet and aligned", () => {
    const editor = source("src/app/(app)/schedule/_components/WorkingCrewEditor.tsx");

    expect(editor).toContain('const SLOT_ROW_GRID_CLASS = "grid-cols-[minmax(0,1fr)_5rem_5.5rem_2.5rem]"');
    expect(editor).toContain('className="h-10 w-[5.5rem] justify-start gap-1.5 px-2 text-xs tabular-nums text-muted-foreground"');
    expect(editor).toContain('className="h-10 w-20 px-3 text-xs"');
    expect(editor).toContain("Add slot");
    expect(editor).toContain("Unassign worker");
    expect(editor).toContain("Remove slot");
    expect(editor).toContain('className="divide-y divide-border/40 border-y border-border/40"');
    expect(editor).not.toContain("Tooltip");
    expect(editor).not.toContain('<Badge variant="green" size="sm">Published</Badge>');
    expect(editor).not.toContain('size="icon-xs"');
  });

  it("cross-fades collaborator follow-state icons without animating initial render", () => {
    const collaborator = source("src/app/(app)/schedule/_components/CollaboratorSchedule.tsx");

    expect(collaborator).toContain('<AnimatePresence initial={false} mode="popLayout">');
    expect(collaborator).toContain('initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}');
    expect(collaborator).toContain('transition={{ type: "spring", duration: 0.3, bounce: 0 }}');
  });
});
