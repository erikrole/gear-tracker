import type { LucideIcon } from "lucide-react";
import { AlertTriangleIcon, CalendarDaysIcon, CheckCircle2Icon, ClockIcon, Repeat2Icon, UserCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "./types";
import { ACTIVE_STATUSES } from "./types";

type ScheduleReadinessProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  currentUserId: string;
  openTradeCount: number;
};

type ReadinessTone = "attention" | "critical" | "good" | "neutral";

type ReadinessItem = {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone: ReadinessTone;
  wide?: boolean;
};

function missingSlots(entry: CalendarEntry) {
  if (!entry.coverage) return 0;
  return Math.max(entry.coverage.total - entry.coverage.filled, 0);
}

function userHasActiveShift(entry: CalendarEntry, userId: string) {
  if (!userId) return false;
  return entry.shifts.some((shift) =>
    shift.assignments.some(
      (assignment) =>
        assignment.user.id === userId &&
        ACTIVE_STATUSES.includes(assignment.status),
    ),
  );
}

function formatNextCall(entries: CalendarEntry[]) {
  const now = Date.now();
  const next = entries
    .filter((entry) => new Date(entry.endsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (!next) return "No upcoming calls";

  const callSource = next.shifts.length > 0
    ? next.shifts.reduce((earliest, shift) =>
        new Date(shift.startsAt).getTime() < new Date(earliest.startsAt).getTime()
          ? shift
          : earliest,
      next.shifts[0]!)
    : next;

  return new Date(callSource.startsAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduleReadiness({
  entries,
  filteredEntries,
  currentUserId,
  openTradeCount,
}: ScheduleReadinessProps) {
  const openSlots = filteredEntries.reduce((sum, entry) => sum + missingSlots(entry), 0);
  const needsCoverageEvents = filteredEntries.filter((entry) => missingSlots(entry) > 0).length;
  const coveredEvents = filteredEntries.filter(
    (entry) => entry.coverage && missingSlots(entry) === 0,
  ).length;
  const myShiftCount = entries.filter((entry) => userHasActiveShift(entry, currentUserId)).length;
  const nextCall = formatNextCall(filteredEntries);

  const items: ReadinessItem[] = [
    {
      label: "Open slots",
      value: openSlots,
      detail: needsCoverageEvents > 0 ? `${needsCoverageEvents} events need coverage` : "Coverage is clean",
      icon: AlertTriangleIcon,
      tone: openSlots > 0 ? "critical" : "good",
    },
    {
      label: "Ready events",
      value: coveredEvents,
      detail: `${filteredEntries.length} in current view`,
      icon: CheckCircle2Icon,
      tone: "good",
    },
    {
      label: "My shifts",
      value: myShiftCount,
      detail: currentUserId ? "Active assignments" : "Sign in required",
      icon: UserCheckIcon,
      tone: "neutral",
    },
    {
      label: "Trade board",
      value: openTradeCount,
      detail: openTradeCount === 1 ? "Open trade" : "Open trades",
      icon: Repeat2Icon,
      tone: openTradeCount > 0 ? "attention" : "neutral",
    },
    {
      label: "Next call",
      value: nextCall,
      detail: "Earliest visible event",
      icon: ClockIcon,
      tone: "neutral",
      wide: true,
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 2xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(220px,1.15fr)]">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "min-h-[74px] rounded-lg border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm transition-[background-color,border-color]",
              item.tone === "critical" && "border-[var(--red-text)]/20 bg-[var(--red-bg)]/20",
              item.tone === "attention" && "border-[var(--orange-text)]/20 bg-[var(--orange-bg)]/20",
              item.tone === "good" && "border-[var(--green-text)]/15",
              item.wide && "col-span-2 2xl:col-span-1",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <Icon
                className={cn(
                  "size-3.5 text-muted-foreground",
                  item.tone === "critical" && "text-[var(--red-text)]",
                  item.tone === "attention" && "text-[var(--orange-text)]",
                  item.tone === "good" && "text-[var(--green-text)]",
                )}
              />
            </div>
            <div className="flex min-w-0 items-baseline gap-2">
              <span
                className={cn(
                  "truncate text-lg font-black leading-none tabular-nums text-foreground",
                  item.wide && "text-sm font-semibold",
                )}
                style={{ fontFamily: item.wide ? undefined : "var(--font-heading)" }}
              >
                {item.value}
              </span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {item.detail}
            </div>
          </div>
        );
      })}
      {filteredEntries.length === 0 && entries.length > 0 && (
        <div className="col-span-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground 2xl:col-span-5">
          <CalendarDaysIcon className="mr-1 inline size-3.5" />
          Current filters hide all schedule entries.
        </div>
      )}
    </div>
  );
}
