import { useMemo } from "react";
import { ListIcon, CalendarIcon } from "lucide-react";
import { FilterChip } from "@/components/FilterChip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
      <ToggleGroup
        type="single"
        value={filters.viewMode}
        onValueChange={(v) => { if (v) filters.setViewMode(v as "list" | "calendar"); }}
        className="h-9"
      >
        <ToggleGroupItem value="list" className="h-9 px-3 gap-1.5 text-sm font-medium">
          <ListIcon className="size-4" />
          List
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" className="h-9 px-3 gap-1.5 text-sm font-medium">
          <CalendarIcon className="size-4" />
          Calendar
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="filter-chips">
        <div className="flex items-center gap-2">
          <Switch
            id="my-shifts-toggle"
            checked={filters.myShiftsOnly}
            onCheckedChange={filters.setMyShiftsOnly}
          />
          <Label htmlFor="my-shifts-toggle" className="text-sm cursor-pointer">My Shifts</Label>
        </div>
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
