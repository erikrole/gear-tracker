"use client";

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
import { useScheduleData } from "@/hooks/use-schedule-data";
import { ScheduleFilters } from "./_components/ScheduleFilters";
import { CalendarView } from "./_components/CalendarView";
import { ListView } from "./_components/ListView";

const ShiftDetailPanel = dynamic(
  () => import("@/components/ShiftDetailPanel"),
  { ssr: false },
);
const TradeBoard = dynamic(() => import("@/components/TradeBoard"), {
  ssr: false,
});

export default function SchedulePage() {
  const data = useScheduleData();

  return (
    <>
      <div className="page-header">
        <h1>Schedule</h1>
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
      </div>

      {/* View toggle + filters */}
      <ScheduleFilters filters={data.filters} entries={data.entries} />

      {/* Calendar View */}
      {data.filters.viewMode === "calendar" && (
        <CalendarView
          entries={data.entries}
          calMonth={data.calMonth}
          setCalMonth={data.setCalMonth}
          expandedDay={data.expandedDay}
          setExpandedDay={data.setExpandedDay}
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
          expandedRowId={data.expandedRowId}
          setExpandedRowId={data.setExpandedRowId}
          onSelectGroup={data.setSelectedGroupId}
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
    </>
  );
}
