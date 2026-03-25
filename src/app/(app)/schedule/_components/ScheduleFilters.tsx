import { useMemo } from "react";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import {
  AREAS,
  AREA_LABELS,
  type CalendarEntry,
} from "./types";
import type { ScheduleFilters as ScheduleFiltersType } from "@/hooks/use-schedule-data";

type ScheduleFiltersProps = {
  filters: ScheduleFiltersType;
  entries: CalendarEntry[];
};

export function ScheduleFilters({ filters, entries }: ScheduleFiltersProps) {
  const sportOptions = useMemo(() => {
    const codes = new Set(
      entries.map((e) => e.sportCode).filter(Boolean) as string[],
    );
    return SPORT_CODES.filter((s) => codes.has(s.code)).map((s) => ({
      value: s.code,
      label: s.label,
    }));
  }, [entries]);

  return (
    <div className="filter-chip-bar mb-1">
      <div className="flex rounded border border-border overflow-hidden">
        <Button
          variant={filters.viewMode === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => filters.setViewMode("list")}
          className="rounded-none border-none"
        >
          List
        </Button>
        <Button
          variant={filters.viewMode === "calendar" ? "default" : "outline"}
          size="sm"
          onClick={() => filters.setViewMode("calendar")}
          className="rounded-none border-none"
        >
          Calendar
        </Button>
      </div>
      <div className="filter-chips">
        <FilterChip
          label="My Shifts"
          value={filters.myShiftsOnly ? "mine" : ""}
          displayValue="My shifts"
          options={[{ value: "mine", label: "My shifts only" }]}
          onSelect={() => filters.setMyShiftsOnly(true)}
          onClear={() => filters.setMyShiftsOnly(false)}
        />
        <FilterChip
          label="Sport"
          value={filters.sportFilter}
          displayValue={
            filters.sportFilter ? sportLabel(filters.sportFilter) : ""
          }
          options={sportOptions}
          onSelect={(v) => filters.setSportFilter(v)}
          onClear={() => filters.setSportFilter("")}
        />
        <FilterChip
          label="Area"
          value={filters.areaFilter}
          displayValue={
            filters.areaFilter
              ? (AREA_LABELS[filters.areaFilter] ?? filters.areaFilter)
              : ""
          }
          options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
          onSelect={(v) => filters.setAreaFilter(v)}
          onClear={() => filters.setAreaFilter("")}
        />
        <FilterChip
          label="Coverage"
          value={filters.coverageFilter}
          displayValue={
            filters.coverageFilter === "unfilled"
              ? "Needs staff"
              : filters.coverageFilter === "filled"
                ? "Fully staffed"
                : ""
          }
          options={[
            { value: "unfilled", label: "Needs staff" },
            { value: "filled", label: "Fully staffed" },
          ]}
          onSelect={(v) => filters.setCoverageFilter(v)}
          onClear={() => filters.setCoverageFilter("")}
        />
        {filters.viewMode === "list" && (
          <FilterChip
            label="Time"
            value={filters.includePast ? "all" : ""}
            displayValue="All events"
            options={[{ value: "all", label: "Include past events" }]}
            onSelect={() => filters.setIncludePast(true)}
            onClear={() => filters.setIncludePast(false)}
          />
        )}
        {filters.hasFilters && (
          <button
            type="button"
            className="filter-chip-clear-all"
            onClick={filters.clearAll}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
