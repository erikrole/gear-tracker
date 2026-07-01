"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CloudAlertIcon,
  ListChecksIcon,
  PackageCheckIcon,
  Repeat2Icon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OperationalMetricCard } from "@/components/OperationalFeedback";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { effectiveCallWindow, isInheritedFullDayCallWindow } from "@/lib/shift-call-windows";
import { formatCalendarEventDateRange } from "@/lib/calendar-event-dates";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import type { ScheduleSourceSignal } from "@/lib/calendar-source-freshness";
import type { ScheduleQueue } from "@/lib/schedule-queues";
import type { ScheduleAutomationDigest as ScheduleAutomationDigestData } from "@/lib/schedule-automation-types";
import type { CalendarEntry } from "./types";
import { ACTIVE_STATUSES } from "./types";
import { ScheduleAutomationCards } from "./ScheduleAutomationDigest";

type ScheduleReadinessProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  currentUserId: string;
  openTradeCount: number;
  health: ScheduleHealthSnapshot | null;
  sourceSignal: ScheduleSourceSignal | null;
  digest: ScheduleAutomationDigestData | null;
  isStaff: boolean;
  onShowQueue: (queue: ScheduleQueue) => void;
  onOpenTradeBoard: () => void;
};

type ReadinessTone = "attention" | "critical" | "good" | "neutral" | "personal";

type ReadinessItem = {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone: ReadinessTone;
  onClick?: () => void;
  href?: string;
};

const METRIC_TONE: Record<ReadinessTone, "red" | "orange" | "green" | "blue" | "muted"> = {
  critical: "red",
  attention: "orange",
  good: "green",
  personal: "blue",
  neutral: "muted",
};

function isActionableValue(value: number | string) {
  return typeof value === "number" ? value > 0 : Boolean(value);
}

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

  // The earliest *real* crew call window - i.e. one with an explicit call time,
  // not an all-day event's inherited full-day window (which would otherwise
  // render as a meaningless "12:00 AM").
  const realCall = next.shifts
    .map((shift) => effectiveCallWindow(shift, shift.assignments.find((assignment) => ACTIVE_STATUSES.includes(assignment.status))))
    .filter((window) => !isInheritedFullDayCallWindow(window))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  // No explicit call on an all-day event -> say "All day", not midnight. Uses the
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

function AttentionChip({ item }: { item: ReadinessItem }) {
  const toneClass = {
    critical: "border-[var(--red-text)]/30 bg-[var(--red-bg)]/50 text-[var(--red-text)] hover:bg-[var(--red-bg)]",
    attention: "border-[var(--orange-text)]/30 bg-[var(--orange-bg)]/50 text-[var(--orange-text)] hover:bg-[var(--orange-bg)]",
    personal: "border-[var(--blue-text)]/30 bg-[var(--blue-bg)]/50 text-[var(--blue-text)] hover:bg-[var(--blue-bg)]",
    good: "border-border/60 text-muted-foreground",
    neutral: "border-border/60 text-muted-foreground",
  }[item.tone];
  const Icon = item.icon;
  const inner = (
    <>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
      <span className="font-bold tabular-nums">{item.value}</span>
    </>
  );
  const className = cn(
    "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
    toneClass,
    (item.onClick || item.href) && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );

  if (item.href) {
    return <Link href={item.href} className={className}>{inner}</Link>;
  }
  if (item.onClick) {
    return <button type="button" onClick={item.onClick} className={className}>{inner}</button>;
  }
  return <span className={className}>{inner}</span>;
}

export function ScheduleReadiness({
  entries,
  filteredEntries,
  currentUserId,
  openTradeCount,
  health,
  sourceSignal,
  digest,
  isStaff,
  onShowQueue,
  onOpenTradeBoard,
}: ScheduleReadinessProps) {
  const [open, setOpen] = useState(false);

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
  const openTrades = health?.queues.openTrades.count ?? openTradeCount;
  const nextCall = health?.nextCall.label ?? formatNextCall(filteredEntries);
  const nextCallHref = health?.nextCall.eventId ? `/events/${health.nextCall.eventId}` : undefined;
  const sourceNeedsAttention = sourceSignal?.severity === "attention";
  const hiddenAndArchivedCount = (health?.queues.hiddenEvents.count ?? 0) + (health?.queues.archivedEvents.count ?? 0);
  const healthWarnings = health?.partialFailures.length ?? 0;

  const items: ReadinessItem[] = [
    {
      label: "Crew needed",
      value: openSlots,
      detail: needsCoverageEvents > 0 ? `${needsCoverageEvents} event${needsCoverageEvents === 1 ? "" : "s"} need crew` : "Crew is set",
      icon: AlertTriangleIcon,
      tone: openSlots > 0 ? "critical" : "good",
      onClick: () => onShowQueue("needs-staffing"),
    },
    {
      label: "Covered",
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
    },
    {
      label: "Trades",
      value: openTrades,
      detail: tradeApprovals > 0
        ? `${tradeApprovals} awaiting approval`
        : openTrades > 0
          ? "Open trades"
          : "No open trades",
      icon: Repeat2Icon,
      tone: openTrades > 0 || tradeApprovals > 0 ? "attention" : "neutral",
      onClick: tradeApprovals > 0 ? () => onShowQueue("trade-approval") : onOpenTradeBoard,
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
          tone: "personal" as const,
          onClick: () => onShowQueue("my-calls-today"),
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
        }]
      : []),
  ];

  const detailItems = [...items, ...contextualItems];
  const attentionItems = detailItems.filter(
    (item) => (item.tone === "critical" || item.tone === "attention") && isActionableValue(item.value),
  );
  const personalItem = contextualItems.find((item) => item.tone === "personal");
  const filtersHideEverything = filteredEntries.length === 0 && entries.length > 0;

  return (
    <section className="mb-4 rounded-lg border border-border/60 bg-card/60 shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Next call - always the leading orientation */}
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Next call</span>
              {nextCallHref ? (
                <Link href={nextCallHref} className="truncate font-semibold hover:underline">
                  {nextCall}
                </Link>
              ) : (
                <span className="truncate font-semibold">{nextCall}</span>
              )}
            </div>

            {/* Details disclosure */}
            <CollapsibleTrigger className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Details
              <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
            </CollapsibleTrigger>
          </div>

          {/* Attention chips (nonzero only), or a calm all-clear line */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => <AttentionChip key={item.label} item={item} />)
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--green-text)]">
                <CheckCircle2Icon className="size-4" />
                Crew set, no open gaps
              </span>
            )}
            {personalItem && <AttentionChip item={personalItem} />}
          </div>
        </div>

        {filtersHideEverything && (
          <div className="px-3 pb-3">
            <EmptyState
              icon="calendar"
              title="Filters hide every event"
              description="Adjust or clear the schedule filters to see events again."
              inline
            />
          </div>
        )}

        <CollapsibleContent>
          <div className="border-t border-border/60 px-3 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {detailItems.map((item) => (
                <OperationalMetricCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={METRIC_TONE[item.tone]}
                  helper={item.detail}
                  href={item.href}
                  onClick={item.onClick}
                />
              ))}
            </div>

            {isStaff && digest && (
              <ScheduleAutomationCards
                digest={digest}
                onShowQueue={onShowQueue}
                onOpenTradeBoard={onOpenTradeBoard}
                className="mt-3 border-t border-border/60 pt-3"
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
