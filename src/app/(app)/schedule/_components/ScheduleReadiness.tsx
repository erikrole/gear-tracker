"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CloudAlertIcon,
  HistoryIcon,
  ListChecksIcon,
  PackageCheckIcon,
  Repeat2Icon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import { OperationalMetricCard } from "@/components/OperationalFeedback";
import {
  OperationalStatusRail,
  type OperationalStatusRailItem,
} from "@/components/OperationalStatusRail";
import EmptyState from "@/components/EmptyState";
import { useFetch } from "@/hooks/use-fetch";
import type { ScheduleHealthSnapshot } from "@/lib/schedule-health-types";
import type { ScheduleSourceSignal } from "@/lib/calendar-source-freshness";
import type { ScheduleQueue } from "@/lib/schedule-queues";
import { filterEntriesForScheduleQueue } from "@/lib/schedule-queues";
import type { ScheduleAutomationDigest as ScheduleAutomationDigestData } from "@/lib/schedule-automation-types";
import type { ScheduleSyncChangesDigest } from "@/lib/schedule-sync-changes-types";
import type { CalendarEntry } from "./types";
import { ACTIVE_STATUSES } from "./types";
import { ScheduleAutomationCards } from "./ScheduleAutomationDigest";
import { ScheduleDailyChanges } from "./ScheduleDailyChanges";
import { ScheduleSourceSignal as ScheduleSourceStatus } from "./ScheduleSourceSignal";

type ScheduleReadinessProps = {
  entries: CalendarEntry[];
  filteredEntries: CalendarEntry[];
  currentUserId: string;
  openTradeCount: number;
  health: ScheduleHealthSnapshot | null;
  sourceSignal: ScheduleSourceSignal | null;
  digest: ScheduleAutomationDigestData | null;
  isStaff: boolean;
  isAdmin: boolean;
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
  scope?: string;
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

export function ScheduleReadiness({
  entries,
  filteredEntries,
  currentUserId,
  openTradeCount,
  health,
  sourceSignal,
  digest,
  isStaff,
  isAdmin,
  onShowQueue,
  onOpenTradeBoard,
}: ScheduleReadinessProps) {
  const {
    data: syncChanges,
    loading: syncChangesLoading,
    error: syncChangesError,
    reload: reloadSyncChanges,
  } = useFetch<ScheduleSyncChangesDigest | null>({
    url: "/api/schedule/sync-changes",
    returnTo: "/schedule",
    refetchOnMount: "always",
    enabled: isAdmin,
    transform: (json) => (json.data as ScheduleSyncChangesDigest | null) ?? null,
  });
  const fallbackOpenSlots = filteredEntries.reduce((sum, entry) => sum + missingSlots(entry), 0);
  const fallbackNeedsCoverageEvents = filteredEntries.filter((entry) => missingSlots(entry) > 0).length;
  const fallbackCoveredEvents = filteredEntries.filter(
    (entry) => entry.coverage && missingSlots(entry) === 0,
  ).length;
  const myCallsTodayEntries = filterEntriesForScheduleQueue({
    entries,
    queue: "my-calls-today",
    currentUserId,
  });
  const myCallsTodayCount = userActiveShiftCount(myCallsTodayEntries, currentUserId);
  const myCallsTodayEventCount = myCallsTodayEntries.length;
  const openSlots = health?.queues.openSlots.count ?? fallbackOpenSlots;
  const needsCoverageEvents = health?.queues.openSlots.eventCount ?? fallbackNeedsCoverageEvents;
  const coveredEvents = health?.queues.coveredEvents.count ?? fallbackCoveredEvents;
  const totalVisibleEvents = health?.queues.coveredEvents.totalVisibleEvents ?? filteredEntries.length;
  const pendingRequests = health?.queues.pendingRequests.count ?? 0;
  const conflicts = health?.queues.conflicts.count ?? 0;
  const gearGaps = health?.queues.gearGaps.count ?? 0;
  const dataQualityIssues = health?.queues.dataQuality.count ?? 0;
  const dataQualityEvents = health?.queues.dataQuality.eventCount ?? 0;
  const workerClassMismatchCount = health?.queues.dataQuality.issues.filter((issue) => issue.reason === "role_slot_mismatch").length ?? 0;
  const tradeApprovals = health?.queues.tradeApprovals.count ?? 0;
  const openTrades = health?.queues.openTrades.count ?? openTradeCount;
  const sourceNeedsAttention = sourceSignal?.severity === "attention";
  const hiddenAndArchivedCount = (health?.queues.hiddenEvents.count ?? 0) + (health?.queues.archivedEvents.count ?? 0);
  const healthWarnings = health?.partialFailures.length ?? 0;

  const items: ReadinessItem[] = [
    {
      label: "Crew needed",
      value: openSlots,
      scope: `${needsCoverageEvents} event${needsCoverageEvents === 1 ? "" : "s"}`,
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
    ...(myCallsTodayCount > 0
      ? [{
          label: "My calls today",
          value: myCallsTodayCount,
          detail: currentUserId
            ? `${myCallsTodayEventCount} event${myCallsTodayEventCount === 1 ? "" : "s"} assigned`
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
          label: healthWarnings > 0 ? "Health check" : "Source health",
          value: sourceNeedsAttention || healthWarnings > 0 ? "Check" : hiddenAndArchivedCount,
          detail: healthWarnings > 0
            ? "Refresh before treating a clean result as final"
            : sourceNeedsAttention
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
  const showAllClear = attentionItems.length === 0 && healthWarnings === 0;
  const filtersHideEverything = filteredEntries.length === 0 && entries.length > 0;
  const railItems: OperationalStatusRailItem[] = [
    ...attentionItems,
    ...(personalItem ? [personalItem] : []),
  ].map((item) => ({
    id: item.label,
    label: item.label,
    value: item.value,
    detail: item.detail,
    icon: item.icon,
    tone: item.tone === "critical" ? "critical" : item.tone === "personal" ? "info" : "warning",
    onSelect: item.onClick,
    href: item.href,
    scope: item.scope,
  }));
  const syncChangeCount = syncChanges
    ? syncChanges.totals.added + syncChanges.totals.modified + syncChanges.totals.removed
    : 0;
  const syncChangeValue = syncChangesLoading
    ? "Checking…"
    : syncChangesError
      ? "Unavailable"
      : syncChanges
        ? `${syncChangeCount} change${syncChangeCount === 1 ? "" : "s"}`
        : "Not recorded";

  return (
    <OperationalStatusRail
      className="mb-3"
      items={railItems}
      allClearLabel={showAllClear ? "Crew set, no open gaps" : undefined}
      orientation={isAdmin ? {
        label: "Daily fetch",
        value: syncChangeValue,
        icon: HistoryIcon,
        tone: "change",
      } : undefined}
      notice={filtersHideEverything ? (
        <EmptyState
          icon="calendar"
          title="Filters hide every event"
          description="Adjust or clear the schedule filters to see events again."
          inline
        />
      ) : undefined}
      details={(
        <>
            {isAdmin && (
              <ScheduleDailyChanges
                digest={syncChanges}
                loading={syncChangesLoading}
                error={syncChangesError}
                reload={reloadSyncChanges}
                className="mb-3 border-b border-border/60 pb-3"
              />
            )}
            {sourceSignal && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Schedule sources</span>
                <ScheduleSourceStatus signal={sourceSignal} />
              </div>
            )}
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
        </>
      )}
    />
  );
}
