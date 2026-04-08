import { useMemo } from "react";
import { FilterIcon, ListIcon, CalendarIcon, CalendarDaysIcon, XIcon } from "lucide-react";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import {
  AREAS,
  AREA_LABELS,
  type CalendarEntry,
} from "./types";
import type { ScheduleFilters as ScheduleFiltersType, ViewMode, HomeAwayFilter } from "@/hooks/use-schedule-data";

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

  // Count active data filters (excludes my-shifts and past-events which are now in toolbar)
  const activeFilterCount = [
    filters.sportFilter,
    filters.areaFilter,
    filters.coverageFilter,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-row items-center gap-2 flex-wrap mb-1">
      {/* View mode — always visible */}
      <ToggleGroup
        type="single"
        value={filters.viewMode}
        onValueChange={(v) => { if (v) filters.setViewMode(v as ViewMode); }}
        className="h-9"
      >
        <ToggleGroupItem value="list" className="h-9 px-3 gap-1.5 text-sm font-medium">
          <ListIcon className="size-4" />
          List
        </ToggleGroupItem>
        <ToggleGroupItem value="week" className="h-9 px-3 gap-1.5 text-sm font-medium">
          <CalendarDaysIcon className="size-4" />
          Week
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" className="h-9 px-3 gap-1.5 text-sm font-medium">
          <CalendarIcon className="size-4" />
          Calendar
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Home/Away — always visible */}
      <ToggleGroup
        type="single"
        value={filters.homeAwayFilter}
        onValueChange={(v) => { if (v) filters.setHomeAwayFilter(v as HomeAwayFilter); }}
      >
        <ToggleGroupItem value="all" className="h-9 px-3 text-sm font-medium">All</ToggleGroupItem>
        <ToggleGroupItem value="home" className="h-9 px-3 text-sm font-medium">Home</ToggleGroupItem>
        <ToggleGroupItem value="away" className="h-9 px-3 text-sm font-medium">Away</ToggleGroupItem>
        <ToggleGroupItem value="neutral" className="h-9 px-3 text-sm font-medium">Neutral</ToggleGroupItem>
      </ToggleGroup>

      {/* My Shifts — prominent toggle in toolbar */}
      <div className="flex items-center gap-1.5 h-9 px-2 rounded-md border border-border bg-background">
        <Switch
          id="my-shifts-toggle"
          checked={filters.myShiftsOnly}
          onCheckedChange={filters.setMyShiftsOnly}
          className="scale-90"
        />
        <Label htmlFor="my-shifts-toggle" className="text-sm font-medium cursor-pointer whitespace-nowrap">My Shifts</Label>
      </div>

      {/* Past events — prominent toggle in toolbar (list view only) */}
      {filters.viewMode === "list" && (
        <div className="flex items-center gap-1.5 h-9 px-2 rounded-md border border-border bg-background">
          <Switch
            id="past-events-toggle"
            checked={filters.includePast}
            onCheckedChange={filters.setIncludePast}
            className="scale-90"
          />
          <Label htmlFor="past-events-toggle" className="text-sm font-medium cursor-pointer whitespace-nowrap">Past events</Label>
        </div>
      )}

      {/* Data filters — in a popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={activeFilterCount > 0 ? "default" : "outline"} size="sm" className="h-9 gap-1.5">
            <FilterIcon className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center size-5 rounded-full bg-white/20 text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="flex flex-col gap-3">
            {/* Sport */}
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

            {/* Area */}
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

            {/* Coverage */}
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

            {/* Clear all */}
            {filters.hasFilters && (
              <div className="pt-1 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-medium w-full"
                  onClick={filters.clearAll}
                >
                  <XIcon className="size-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
