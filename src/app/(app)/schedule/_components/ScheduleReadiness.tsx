import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CloudAlertIcon,
  ListChecksIcon,
  PackageCheckIcon,
  Repeat2Icon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { effectiveCallWindow, isInheritedFullDayCallWindow } from "@/lib/shift-call-windows";
import { formatCalendarEventDateRange } from "@/lib/calendar-event-dates";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import type { ScheduleSourceSignal } from "@/lib/calendar-source-freshness";
import type { ScheduleQueue } from "@/lib/schedule-queues";
import type { CalendarEntry } from "./types";
import { ACTIVE_STATUSES } from "./types";

type ScheduleReadinessProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  currentUserId: string;
  openTradeCount: number;
  health: ScheduleHealthSnapshot | null;
  sourceSignal: ScheduleSourceSignal | null;
  onShowQueue: (queue: ScheduleQueue) => void;
  onOpenTradeBoard: () => void;
};

type ReadinessTone = "attention" | "critical" | "good" | "neutral";

type ReadinessItem = {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone: ReadinessTone;
  wide?: boolean;
  actionLabel?: string;
  onClick?: () => void;
  href?: string;
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

function userActiveShiftCount(entries: CalendarEntry[], userId: string) {
  if (!userId) return 0;
  return entries.reduce((count, entry) => {
    return count + entry.shifts.reduce((shiftCount, shift) => {
      const hasAssignment = shift.assignments.some(
        (assignment) =>
          assignment.user.id === userId &&
          ACTIVE_STATUSES.includes(assignment.status),
      );
      return shiftCount + (hasAssignment ? 1 : 0);
    }, 0);
  }, 0);
}

function formatNextCall(entries: CalendarEntry[]) {
  const now = Date.now();
  const next = entries
    .filter((entry) => new Date(entry.endsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (!next) return "No upcoming calls";

  // The earliest *real* crew call window — i.e. one with an explicit call time,
  // not an all-day event's inherited full-day window (which would otherwise
  // render as a meaningless "12:00 AM").
  const realCall = next.shifts
    .map((shift) => effectiveCallWindow(shift, shift.assignments.find((assignment) => ACTIVE_STATUSES.includes(assignment.status))))
    .filter((window) => !isInheritedFullDayCallWindow(window))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  // No explicit call on an all-day event → say "All day", not midnight. Uses the
  // all-day-aware (UTC) date formatter so the date doesn't shift by timezone.
  if (!realCall && next.allDay) {
    return `${formatCalendarEventDateRange(next, { includeYear: false })} · All day`;
  }

  return new Date(realCall ? realCall.startsAt : next.startsAt).toLocaleString("en-US", {
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
  health,
  sourceSignal,
  onShowQueue,
  onOpenTradeBoard,
}: ScheduleReadinessProps) {
  const fallbackOpenSlots = filteredEntries.reduce((sum, entry) => sum + missingSlots(entry), 0);
  const fallbackNeedsCoverageEvents = filteredEntries.filter((entry) => missingSlots(entry) > 0).length;
  const fallbackCoveredEvents = filteredEntries.filter(
    (entry) => entry.coverage && missingSlots(entry) === 0,
  ).length;
  const fallbackMyShiftCount = userActiveShiftCount(entries, currentUserId);
  const fallbackMyShiftEventCount = entries.filter((entry) => userHasActiveShift(entry, currentUserId)).length;
  const openSlots = health?.queues.openSlots.count ?? fallbackOpenSlots;
  const needsCoverageEvents = health?.queues.openSlots.eventCount ?? fallbackNeedsCoverageEvents;
  const coveredEvents = health?.queues.coveredEvents.count ?? fallbackCoveredEvents;
  const totalVisibleEvents = health?.queues.coveredEvents.totalVisibleEvents ?? filteredEntries.length;
  const myShiftCount = health?.queues.myShifts.count ?? fallbackMyShiftCount;
  const myShiftEventCount = health?.queues.myShifts.eventCount ?? fallbackMyShiftEventCount;
  const pendingRequests = health?.queues.pendingRequests.count ?? 0;
  const conflicts = health?.queues.conflicts.count ?? 0;
  const gearGaps = health?.queues.gearGaps.count ?? 0;
  const dataQualityIssues = health?.queues.dataQuality.count ?? 0;
  const dataQualityEvents = health?.queues.dataQuality.eventCount ?? 0;
  const workerClassMismatchCount = health?.queues.dataQuality.issues.filter((issue) => issue.reason === "role_slot_mismatch").length ?? 0;
  const tradeApprovals = health?.queues.tradeApprovals.count ?? 0;
  const nextCall = health?.nextCall.label ?? formatNextCall(filteredEntries);
  const sourceNeedsAttention = sourceSignal?.severity === "attention";
  const hiddenAndArchivedCount = (health?.queues.hiddenEvents.count ?? 0) + (health?.queues.archivedEvents.count ?? 0);
  const healthWarnings = health?.partialFailures.length ?? 0;

  const items: ReadinessItem[] = [
    {
      label: "Next call",
      value: nextCall,
      detail: "Earliest visible event",
      icon: ClockIcon,
      tone: "neutral",
      wide: true,
      href: health?.nextCall.eventId ? `/events/${health.nextCall.eventId}` : undefined,
      actionLabel: health?.nextCall.eventId ? "Open next event" : undefined,
    },
    {
      label: "Crew needed",
      value: openSlots,
      detail: needsCoverageEvents > 0 ? `${needsCoverageEvents} events need crew` : "Crew is set",
      icon: AlertTriangleIcon,
      tone: openSlots > 0 ? "critical" : "good",
      onClick: () => onShowQueue("needs-staffing"),
      actionLabel: "Open queue",
    },
    {
      label: "Covered events",
      value: coveredEvents,
      detail: `${totalVisibleEvents} event${totalVisibleEvents === 1 ? "" : "s"} in current view`,
      icon: CheckCircle2Icon,
      tone: "good",
    },
    {
      label: "Gear gaps",
      value: gearGaps,
      detail: gearGaps > 0
        ? `${gearGaps} assigned worker${gearGaps === 1 ? "" : "s"} without linked gear`
        : "No gear gaps",
      icon: PackageCheckIcon,
      tone: gearGaps > 0 ? "attention" : "good",
      onClick: () => onShowQueue("gear-gaps"),
      actionLabel: "Open queue",
    },
    {
      label: "Data quality",
      value: dataQualityIssues,
      detail: workerClassMismatchCount > 0
        ? `${workerClassMismatchCount} crew worker-class mismatch${workerClassMismatchCount === 1 ? "" : "es"}`
        : dataQualityIssues > 0
        ? `${dataQualityEvents} event${dataQualityEvents === 1 ? "" : "s"} need cleanup`
        : "Event data looks clean",
      icon: ListChecksIcon,
      tone: dataQualityIssues > 0 ? "attention" : "good",
      onClick: () => onShowQueue("data-quality"),
      actionLabel: "Open queue",
    },
    {
      label: "Trade board",
      value: health?.queues.openTrades.count ?? openTradeCount,
      detail: tradeApprovals > 0
        ? `${tradeApprovals} awaiting approval`
        : (health?.queues.openTrades.count ?? openTradeCount) > 0
          ? "Open trades"
          : "No open trades",
      icon: Repeat2Icon,
      tone: (health?.queues.openTrades.count ?? openTradeCount) > 0 || tradeApprovals > 0 ? "attention" : "neutral",
      onClick: tradeApprovals > 0 ? () => onShowQueue("trade-approval") : onOpenTradeBoard,
      actionLabel: tradeApprovals > 0 ? "Review" : "Open board",
    },
  ];

  const contextualItems: ReadinessItem[] = [
    ...(myShiftCount > 0
      ? [{
          label: "My shifts",
          value: myShiftCount,
          detail: currentUserId
            ? `${myShiftEventCount} event${myShiftEventCount === 1 ? "" : "s"} assigned`
            : "Sign in required",
          icon: UserCheckIcon,
          tone: "neutral" as const,
          onClick: () => onShowQueue("my-calls-today"),
          actionLabel: "Today",
        }]
      : []),
    ...(pendingRequests > 0
      ? [{
          label: "Requests",
          value: pendingRequests,
          detail: pendingRequests === 1 ? "Pending assignment request" : "Pending assignment requests",
          icon: UsersIcon,
          tone: "attention" as const,
          onClick: () => onShowQueue("pending-requests"),
          actionLabel: "Open queue",
        }]
      : []),
    ...(conflicts > 0
      ? [{
          label: "Conflicts",
          value: conflicts,
          detail: conflicts === 1 ? "Assignment conflict" : "Assignment conflicts",
          icon: AlertTriangleIcon,
          tone: "critical" as const,
          onClick: () => onShowQueue("conflicts"),
          actionLabel: "Open queue",
        }]
      : []),
    ...((sourceNeedsAttention || hiddenAndArchivedCount > 0 || healthWarnings > 0)
      ? [{
          label: "Source health",
          value: sourceNeedsAttention ? "Check" : hiddenAndArchivedCount,
          detail: sourceNeedsAttention
            ? sourceSignal.label
            : hiddenAndArchivedCount > 0
              ? "Hidden or archived events"
              : "Sources and visibility need review",
          icon: CloudAlertIcon,
          tone: "attention" as const,
          onClick: sourceNeedsAttention ? () => onShowQueue("stale-source") : undefined,
          actionLabel: sourceNeedsAttention ? "Open queue" : undefined,
        }]
      : []),
  ];

  const readinessItems = [...items, ...contextualItems];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
      {readinessItems.map((item) => {
        const Icon = item.icon;
        const className = cn(
          "group min-h-[86px] rounded-lg border border-border/60 bg-card/80 px-3 py-2.5 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform]",
          (item.onClick || item.href) && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.tone === "critical" && "border-[var(--red-text)]/20 bg-[var(--red-bg)]/20",
          item.tone === "attention" && "border-[var(--orange-text)]/20 bg-[var(--orange-bg)]/20",
          item.tone === "good" && "border-[var(--green-text)]/15",
          item.wide && "col-span-2 border-primary/20 bg-primary/5 lg:col-span-1",
        );
        const content = (
          <>
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
                  item.wide && "text-base font-semibold",
                )}
                style={{ fontFamily: item.wide ? undefined : "var(--font-heading)" }}
              >
                {item.value}
              </span>
            </div>
            <div className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
              {item.detail}
            </div>
            {item.actionLabel && (
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary opacity-80 transition-opacity group-hover:opacity-100">
                {item.actionLabel}
              </div>
            )}
          </>
        );

        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className={className}>
              {content}
            </Link>
          );
        }

        if (item.onClick) {
          return (
            <button key={item.label} type="button" className={className} onClick={item.onClick}>
              {content}
            </button>
          );
        }

        return (
          <div key={item.label} className={className}>
            {content}
          </div>
        );
      })}
      {filteredEntries.length === 0 && entries.length > 0 && (
        <div className="col-span-full">
          <EmptyState
            icon="calendar"
            title="Filters hide every event"
            description="Adjust or clear the schedule filters to see events again."
            inline
          />
        </div>
      )}
    </div>
  );
}
