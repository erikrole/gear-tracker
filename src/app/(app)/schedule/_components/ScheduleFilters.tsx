import { useMemo } from "react";
import { FilterIcon, ListIcon, CalendarIcon, CalendarDaysIcon, XIcon } from "lucide-react";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";
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

const VIEW_MODES: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "list", label: "List", icon: <ListIcon className="size-3.5" /> },
  { value: "week", label: "Week", icon: <CalendarDaysIcon className="size-3.5" /> },
  { value: "calendar", label: "Calendar", icon: <CalendarIcon className="size-3.5" /> },
];

const HOME_AWAY_OPTIONS: { value: HomeAwayFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "neutral", label: "Neutral" },
];

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

  const activeFilterCount = [
    filters.sportFilter,
    filters.areaFilter,
    filters.coverageFilter,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-row items-center gap-1.5 flex-wrap mb-4 pb-3 border-b border-border/60">
      {/* View mode toggle */}
      <div className="flex items-center rounded-md border border-border overflow-hidden bg-muted/30">
        {VIEW_MODES.map((mode, i) => {
          const isActive = filters.viewMode === mode.value;
          return (
            <button
              key={mode.value}
              onClick={() => filters.setViewMode(mode.value)}
              aria-pressed={isActive}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium transition-all",
                i > 0 && "border-l border-border",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              {mode.icon}
              <span className="max-sm:hidden">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border/80 mx-0.5 max-sm:hidden" />

      {/* Home / Away filter */}
      <div className="flex items-center rounded-md border border-border overflow-hidden bg-muted/30">
        {HOME_AWAY_OPTIONS.map((opt, i) => {
          const isActive = filters.homeAwayFilter === opt.value;
          const activeColor =
            opt.value === "home"
              ? "bg-[var(--green)]/15 text-[var(--green-text)]"
              : opt.value === "away"
                ? "bg-[var(--orange)]/15 text-[var(--orange-text)]"
                : "bg-background text-foreground";
          return (
            <button
              key={opt.value}
              onClick={() => filters.setHomeAwayFilter(opt.value)}
              aria-pressed={isActive}
              className={cn(
                "px-2.5 h-8 text-[13px] font-medium transition-all",
                i > 0 && "border-l border-border",
                isActive
                  ? cn(activeColor, "shadow-sm")
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border/80 mx-0.5 max-sm:hidden" />

      {/* My Shifts toggle */}
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-muted/30">
        <Switch
          id="my-shifts-toggle"
          checked={filters.myShiftsOnly}
          onCheckedChange={filters.setMyShiftsOnly}
          className="scale-[0.8] origin-center"
        />
        <Label
          htmlFor="my-shifts-toggle"
          className="text-[13px] font-medium cursor-pointer whitespace-nowrap"
        >
          My Shifts
        </Label>
      </div>

      {/* Past events toggle — list view only */}
      {filters.viewMode === "list" && (
        <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-muted/30">
          <Switch
            id="past-events-toggle"
            checked={filters.includePast}
            onCheckedChange={filters.setIncludePast}
            className="scale-[0.8] origin-center"
          />
          <Label
            htmlFor="past-events-toggle"
            className="text-[13px] font-medium cursor-pointer whitespace-nowrap"
          >
            Past
          </Label>
        </div>
      )}

      {/* Data filters popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
          >
            <FilterIcon className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center size-[18px] rounded-full bg-white/20 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="flex flex-col gap-3">
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
