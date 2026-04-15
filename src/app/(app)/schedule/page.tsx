"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
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

const ShiftDetailPanel = dynamic(
  () => import("@/components/ShiftDetailPanel"),
  { ssr: false },
);
const TradeBoard = dynamic(() => import("@/components/TradeBoard"), {
  ssr: false,
});

export default function SchedulePage() {
  const data = useScheduleData();
  const isStaff = data.currentUserRole === "STAFF" || data.currentUserRole === "ADMIN";
  const hidingRef = useRef<Set<string>>(new Set());
  const [newEventOpen, setNewEventOpen] = useState(false);

  const handleHideEvent = useCallback(async (eventId: string) => {
    if (hidingRef.current.has(eventId)) return;
    hidingRef.current.add(eventId);
    try {
      const res = await fetch(`/api/calendar-events/${eventId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: true }),
      });
      if (handleAuthRedirect(res)) return;
      if (res.ok) {
        data.loadData();
      } else {
        const msg = await parseErrorMessage(res, "Failed to hide event");
        toast.error(msg);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      const kind = classifyError(err);
      toast.error(
        kind === "network"
          ? "You\u2019re offline \u2014 could not hide event"
          : "Something went wrong \u2014 could not hide event",
      );
    } finally {
      hidingRef.current.delete(eventId);
    }
  }, [data.loadData]);

  return (
    <FadeUp>
      <PageHeader title="Schedule">
        {isStaff && (
          <Button variant="outline" size="sm" onClick={() => setNewEventOpen(true)}>
            New event
          </Button>
        )}
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
      </PageHeader>

      {/* View toggle + filters */}
      <ScheduleFilters filters={data.filters} entries={data.entries} />

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
          includePast={data.filters.includePast}
          hasFilters={data.filters.hasFilters}
          currentUserId={data.currentUserId}
          isStaff={isStaff}
          expandedRowId={data.expandedRowId}
          setExpandedRowId={data.setExpandedRowId}
          onSelectGroup={data.setSelectedGroupId}
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
          if (!open) data.loadTradeCount();
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle>Trade Board</SheetTitle>
          </SheetHeader>
          <SheetBody>
            {data.tradeSheetOpen && (
              <TradeBoard
                currentUserId={data.currentUserId}
                currentUserRole={data.currentUserRole}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </FadeUp>
  );
}
