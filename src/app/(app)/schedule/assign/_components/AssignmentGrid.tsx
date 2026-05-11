"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { GridEvent, GridColumn } from "@/hooks/use-assignment-grid";
import type { PickerUser } from "@/components/shift-detail/UserAvatarPicker";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { AssignmentCell } from "./AssignmentCell";
import { AREA_LABELS } from "@/types/areas";

const WT_LABELS: Record<string, string> = { FT: "Staff", ST: "Student" };

type Props = {
  events: GridEvent[];
  columns: GridColumn[];
  allUsers: PickerUser[];
  usersLoading: boolean;
  isStaff: boolean;
  onRefetch: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
};

export function AssignmentGrid({
  events,
  columns,
  allUsers,
  usersLoading,
  isStaff,
  onRefetch,
  hasFilters,
  onClearFilters,
}: Props) {
  // Group columns by area for header span
  const areaGroups = useMemo(() => {
    const map = new Map<string, GridColumn[]>();
    for (const col of columns) {
      const arr = map.get(col.area) ?? [];
      arr.push(col);
      map.set(col.area, arr);
    }
    return map;
  }, [columns]);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <EmptyState
          icon="calendar"
          title={hasFilters ? "No matching events" : "No events this month"}
          description={
            hasFilters
              ? "Clear the assignment filters or choose another month."
              : "Try another month or sync a calendar source."
          }
          actionLabel={hasFilters ? "Clear filters" : undefined}
          onAction={hasFilters ? onClearFilters : undefined}
          compact
        />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <EmptyState
          icon="users"
          title="No shifts generated"
          description="These events do not have shift slots for the selected month yet."
          compact
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm border-collapse">
        <thead>
          {/* Row 1: area groups */}
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-48 min-w-[12rem] sticky left-0 bg-card z-10">
              Event
            </th>
            {Array.from(areaGroups.entries()).map(([area, cols]) => (
              <th
                key={area}
                colSpan={cols.length}
                className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wide border-l"
              >
                {AREA_LABELS[area] ?? area}
              </th>
            ))}
          </tr>
          {/* Row 2: FT / ST sub-headers */}
          <tr className="border-b bg-muted/30">
            <th className="sticky left-0 bg-muted/30 z-10" />
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-2 py-1 text-center text-xs text-muted-foreground font-normal border-l"
              >
                {WT_LABELS[col.workerType] ?? col.workerType}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const date = new Date(ev.startsAt);
            const dateStr = date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeStr = ev.allDay
              ? "All day"
              : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

            return (
              <tr key={ev.id} className={`border-b transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                {/* Event name cell */}
                <td className="px-3 py-2 sticky left-0 bg-card hover:bg-muted/20 z-10 min-w-[12rem] max-w-[14rem]">
                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-start px-0 py-1 text-left hover:bg-transparent"
                    asChild
                  >
                    <Link href={`/events/${ev.id}`}>
                      <span className="block min-w-0">
                        <span className="block truncate text-xs font-medium leading-tight">{ev.summary}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {dateStr} · {timeStr}
                        </span>
                      </span>
                    </Link>
                  </Button>
                </td>

                {/* Shift assignment cells */}
                {columns.map((col) => {
                  const matchingShifts = ev.shifts.filter(
                    (s) => s.area === col.area && s.workerType === col.workerType,
                  );
                  return (
                    <AssignmentCell
                      key={col.key}
                      shifts={matchingShifts}
                      allUsers={allUsers}
                      usersLoading={usersLoading}
                      isStaff={isStaff}
                      onRefetch={onRefetch}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
