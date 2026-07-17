"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/PageHeader";
import { FadeUp } from "@/components/ui/motion";
import { toast } from "sonner";
import { useScheduleData } from "@/hooks/use-schedule-data";
import { ScheduleFilters } from "./_components/ScheduleFilters";
import { CalendarView } from "./_components/CalendarView";
import { WeekView } from "./_components/WeekView";
import { classifyError, handleAuthRedirect, isAbortError, parseErrorMessage } from "@/lib/errors";
import { ListView } from "./_components/ListView";
import { NewEventSheet } from "./_components/NewEventSheet";
import { ScheduleReadiness } from "./_components/ScheduleReadiness";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CollaboratorSchedule } from "./_components/CollaboratorSchedule";

const ShiftDetailPanel = dynamic(
  () => import("@/components/ShiftDetailPanel"),
  { ssr: false },
);
const TradeBoard = dynamic(() => import("@/components/TradeBoard"), {
  ssr: false,
});

const SCHEDULE_EXPORTS = [
  { type: "roster", label: "Weekly roster" },
  { type: "hours", label: "Hours by person" },
  { type: "open-slots", label: "Open slots" },
  { type: "conflicts", label: "Conflicts" },
  { type: "trades", label: "Trade Board activity" },
  { type: "gear-readiness", label: "Gear readiness" },
] as const;

export default function SchedulePage() {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) {
    return null;
  }
  if (user?.role === "COLLABORATOR") {
    return <CollaboratorSchedule />;
  }
  return <InternalSchedulePage />;
}

function InternalSchedulePage() {
  const data = useScheduleData();
  const isStaff = data.currentUserRole === "STAFF" || data.currentUserRole === "ADMIN";
  const { loadData, setTradeSheetOpen } = data;
  const { queue, setQueue } = data.filters;
  const hidingRef = useRef<Set<string>>(new Set());
  const [hidingEventIds, setHidingEventIds] = useState<Set<string>>(() => new Set());
  const [newEventOpen, setNewEventOpen] = useState(false);

  const handleSetEventVisibility = useCallback(async (eventId: string, isHidden: boolean) => {
    if (hidingRef.current.has(eventId)) return;
    hidingRef.current.add(eventId);
    setHidingEventIds((prev) => new Set(prev).add(eventId));
    try {
      const res = await fetch(`/api/calendar-events/${eventId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        if (isHidden) {
          toast.success("Event hidden", {
            action: {
              label: "Undo",
              onClick: () => {
                void handleSetEventVisibility(eventId, false);
              },
            },
          });
        } else {
          toast.success("Event restored");
        }
        loadData();
      } else {
        const msg = await parseErrorMessage(res, isHidden ? "Failed to hide event" : "Failed to restore event");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(
        kind === "network"
          ? `You're offline - could not ${isHidden ? "hide" : "restore"} event`
          : `Something went wrong - could not ${isHidden ? "hide" : "restore"} event`,
      );
    } finally {
      hidingRef.current.delete(eventId);
      setHidingEventIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  }, [loadData]);

  const handleHideEvent = useCallback((eventId: string) => {
    void handleSetEventVisibility(eventId, true);
  }, [handleSetEventVisibility]);

  const openTradeBoard = useCallback(() => {
    setTradeSheetOpen(true);
  }, [setTradeSheetOpen]);

  const showQueue = useCallback((nextQueue: NonNullable<typeof queue>) => {
    setQueue(nextQueue);
    if (nextQueue === "trade-approval") setTradeSheetOpen(true);
  }, [setQueue, setTradeSheetOpen]);

  const buildExportHref = useCallback((type: (typeof SCHEDULE_EXPORTS)[number]["type"]) => {
    const params = new URLSearchParams({ type });
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (data.filters.viewMode === "calendar") {
      startDate = data.calMonth;
      endDate = new Date(data.calMonth.getFullYear(), data.calMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (data.filters.viewMode === "week") {
      startDate = data.weekStart;
      endDate = new Date(data.weekStart);
      endDate.setDate(data.weekStart.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (data.filters.includePast) {
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      params.set("includePast", "true");
    } else {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      endDate.setHours(23, 59, 59, 999);
    }

    params.set("startDate", startDate.toISOString());
    params.set("endDate", endDate.toISOString());
    if (data.filters.sportFilter) params.set("sportCode", data.filters.sportFilter);
    if (data.filters.includeArchived) {
      params.set("includeArchived", "true");
      params.set("includePast", "true");
    }
    return `/api/schedule/export?${params.toString()}`;
  }, [data.calMonth, data.filters.includeArchived, data.filters.includePast, data.filters.sportFilter, data.filters.viewMode, data.weekStart]);

  useEffect(() => {
    if (queue === "trade-approval") setTradeSheetOpen(true);
  }, [queue, setTradeSheetOpen]);

  return (
    <FadeUp>
      <PageHeader title="Schedule">
        {isStaff ? (
          <>
            <Button size="sm" asChild>
              <Link href="/schedule/assign">Assign shifts</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More schedule actions">
                  <MoreHorizontalIcon data-icon="inline-start" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setNewEventOpen(true)}>
                  New event
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => data.setTradeSheetOpen(true)}>
                  Trade Board
                  {data.openTradeCount > 0 && (
                    <Badge variant="orange" size="sm" className="ml-auto">
                      {data.openTradeCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Export CSV</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {SCHEDULE_EXPORTS.map((item) => (
                    <DropdownMenuItem key={item.type} asChild>
                      <a href={buildExportHref(item.type)}>{item.label}</a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => data.setTradeSheetOpen(true)}
          >
            Trade Board
            {data.openTradeCount > 0 && (
              <Badge variant="orange" size="sm" className="ml-1.5">
                {data.openTradeCount}
              </Badge>
            )}
          </Button>
        )}
      </PageHeader>

      {/* View toggle + filters */}
      <ScheduleFilters
        filters={data.filters}
        entries={data.entries}
      />

      <ScheduleReadiness
        entries={data.entries}
        filteredEntries={data.filteredEntries}
        currentUserId={data.currentUserId}
        openTradeCount={data.openTradeCount}
        health={data.scheduleHealth}
        sourceSignal={data.sourceSignal}
        digest={data.scheduleAutomation}
        isStaff={isStaff}
        onShowQueue={showQueue}
        onOpenTradeBoard={openTradeBoard}
      />

      {/* Calendar View */}
      {data.filters.viewMode === "calendar" && (
        <CalendarView
          entries={data.filteredEntries}
          calMonth={data.calMonth}
          setCalMonth={data.setCalMonth}
          expandedDay={data.expandedDay}
          setExpandedDay={data.setExpandedDay}
          onSelectGroup={data.setSelectedGroupId}
          onSwitchToList={() => data.filters.setViewMode("list")}
        />
      )}

      {/* Week View */}
      {data.filters.viewMode === "week" && (
        <WeekView
          entries={data.filteredEntries}
          weekStart={data.weekStart}
          setWeekStart={data.setWeekStart}
          loading={data.loading}
          currentUserId={data.currentUserId}
          currentUserRole={data.currentUserRole}
          myShiftsOnly={data.filters.myShiftsOnly}
          onSelectGroup={data.setSelectedGroupId}
        />
      )}

      {/* List View */}
      {data.filters.viewMode === "list" && (
        <ListView
          entries={data.entries}
          filteredEntries={data.filteredEntries}
          groupedEntries={data.groupedEntries}
          loading={data.loading}
          loadError={data.loadError}
          loadData={data.loadData}
          myShiftsOnly={data.filters.myShiftsOnly}
          setMyShiftsOnly={data.filters.setMyShiftsOnly}
          clearFilters={data.filters.clearAll}
          includePast={data.filters.includePast}
          hasFilters={data.filters.hasFilters}
          activeQueueMeta={data.filters.queueMeta}
          clearQueue={() => data.filters.setQueue(null)}
          currentUserId={data.currentUserId}
          isStaff={isStaff}
          scheduleHealth={data.scheduleHealth}
          expandedRowId={data.expandedRowId}
          setExpandedRowId={data.setExpandedRowId}
          onSelectGroup={data.setSelectedGroupId}
          hidingEventIds={hidingEventIds}
          onHideEvent={isStaff ? handleHideEvent : undefined}
        />
      )}

      {/* Shift detail panel */}
      {data.selectedGroupId && (
        <ShiftDetailPanel
          groupId={data.selectedGroupId}
          onClose={() => data.setSelectedGroupId(null)}
          onUpdated={data.loadData}
          currentUserId={data.currentUserId}
          currentUserRole={data.currentUserRole}
        />
      )}

      {/* New Event sheet (staff/admin only) */}
      {isStaff && (
        <NewEventSheet
          open={newEventOpen}
          onOpenChange={setNewEventOpen}
          onCreated={data.loadData}
        />
      )}

      {/* Trade Board sheet */}
      <Sheet
        open={data.tradeSheetOpen}
        onOpenChange={(open) => {
          data.setTradeSheetOpen(open);
          if (!open && data.filters.queue === "trade-approval") data.filters.setQueue(null);
          if (!open) data.loadTradeCount();
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle>Trade Board</SheetTitle>
            <SheetDescription>
              Review, claim, approve, decline, or cancel posted shift trades.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {data.tradeSheetOpen && (
              <TradeBoard
                currentUserId={data.currentUserId}
                currentUserRole={data.currentUserRole}
                initialStatusFilter={data.filters.queue === "trade-approval" ? "CLAIMED" : undefined}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </FadeUp>
  );
}
