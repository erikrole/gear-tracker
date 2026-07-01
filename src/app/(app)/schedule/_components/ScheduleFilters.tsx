import { useMemo, type ReactNode } from "react";
import { FilterIcon, ListIcon, CalendarIcon, CalendarDaysIcon, XIcon, WorkflowIcon } from "lucide-react";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
import { OperationalToolbar } from "@/components/OperationalToolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SPORT_CODES, sportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { VENUE_FILTER_OPTIONS, venueFilterActiveClass } from "@/lib/venue-tone";
import {
  AREAS,
  AREA_LABELS,
  type CalendarEntry,
} from "./types";
import { ScheduleSourceSignal } from "./ScheduleSourceSignal";
import type { ScheduleFilters as ScheduleFiltersType, ViewMode, HomeAwayFilter } from "@/hooks/use-schedule-data";
import type { ScheduleSourceSignal as ScheduleSourceSignalData } from "@/lib/calendar-source-freshness";

type ScheduleFiltersProps = {
  filters: ScheduleFiltersType;
  entries: CalendarEntry[];
  sourceSignal: ScheduleSourceSignalData | null;
};

const VIEW_MODES: { value: ViewMode; label: string; icon: ReactNode }[] = [
  { value: "list", label: "List", icon: <ListIcon className="size-3.5" /> },
  { value: "week", label: "Week", icon: <CalendarDaysIcon className="size-3.5" /> },
  { value: "calendar", label: "Calendar", icon: <CalendarIcon className="size-3.5" /> },
];

const HOME_AWAY_OPTIONS = VENUE_FILTER_OPTIONS as Array<{ value: HomeAwayFilter; label: string }>;

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 max-sm:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ScheduleFilters({ filters, entries, sourceSignal }: ScheduleFiltersProps) {
  const sportOptions = useMemo(() => {
    const codes = new Set(
      entries.map((e) => e.sportCode).filter(Boolean) as string[],
    );
    return SPORT_CODES.filter((s) => codes.has(s.code)).map((s) => ({
      value: s.code,
      label: s.label,
    }));
  }, [entries]);

  const isListView = filters.viewMode === "list";
  const popoverFilterCount = [
    filters.sportFilter,
    filters.areaFilter,
    filters.coverageFilter,
    isListView && filters.includePast ? "past" : "",
    isListView && filters.includeArchived ? "archived" : "",
  ].filter(Boolean).length;

  return (
    <OperationalToolbar className="mb-4">
      {filters.queueMeta && (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md bg-primary/5 px-3 py-2 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.14)]">
          <div className="flex min-w-0 items-center gap-2">
            <WorkflowIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {filters.queueMeta.label}
              </div>
              <div className="text-pretty text-xs text-muted-foreground">
                Shareable Schedule queue from the current window.
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 gap-1.5 px-2.5 text-xs"
            onClick={() => filters.setQueue(null)}
          >
            <XIcon className="size-3.5" />
            Clear queue
          </Button>
        </div>
      )}
      <div className="flex flex-row items-center gap-2 flex-wrap">
        {/* View mode toggle */}
        <ToolbarGroup label="View">
          <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/30 p-0.5">
            <ToggleGroup
              type="single"
              value={filters.viewMode}
              onValueChange={(value) => {
                if (value) filters.setViewMode(value as ViewMode);
              }}
              className="bg-transparent p-0"
              aria-label="Schedule view"
            >
              {VIEW_MODES.map((mode) => (
                <ToggleGroupItem
                  key={mode.value}
                  value={mode.value}
                  aria-label={`${mode.label} view`}
                  className="h-10 gap-1.5 px-3 text-[13px]"
                >
                  {mode.icon}
                  <span className="max-sm:hidden">{mode.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </ToolbarGroup>

        {/* Divider */}
        <div className="mx-0.5 h-6 w-px bg-border/80 max-sm:hidden" />

        {/* Venue filter */}
        <ToolbarGroup label="Venue">
          <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/30 p-0.5">
            <ToggleGroup
              type="single"
              value={filters.homeAwayFilter}
              onValueChange={(value) => {
                if (value) filters.setHomeAwayFilter(value as HomeAwayFilter);
              }}
              className="bg-transparent p-0"
              aria-label="Venue filter"
            >
              {HOME_AWAY_OPTIONS.map((opt) => {
                const isActive = filters.homeAwayFilter === opt.value;
                return (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    aria-label={`${opt.label} events`}
                    className={cn(
                      "h-10 px-2.5 text-[13px]",
                      isActive
                        ? cn(venueFilterActiveClass(opt.value), "shadow-sm")
                        : "hover:bg-background/50",
                    )}
                  >
                    {opt.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </ToolbarGroup>

        {/* Divider */}
        <div className="mx-0.5 h-6 w-px bg-border/80 max-sm:hidden" />

        {/* My Shifts toggle */}
        <div className="flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5">
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

        {/* Data filters popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={popoverFilterCount > 0 ? "default" : "outline"}
              size="sm"
              className="h-10 gap-1.5 text-[13px]"
            >
              <FilterIcon className="size-3.5" />
              Filters
              {popoverFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center size-[18px] rounded-full bg-white/20 text-[10px] font-bold">
                  {popoverFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <div className="flex flex-col gap-3">
              {isListView && (
                <div className="flex flex-col gap-2 border-b border-border/50 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="past-events-toggle" className="text-[13px] font-medium cursor-pointer">
                      Past events
                    </Label>
                    <Switch
                      id="past-events-toggle"
                      checked={filters.includePast}
                      onCheckedChange={filters.setIncludePast}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="archived-events-toggle" className="text-[13px] font-medium cursor-pointer">
                      Archived events
                    </Label>
                    <Switch
                      id="archived-events-toggle"
                      checked={filters.includeArchived}
                      onCheckedChange={filters.setIncludeArchived}
                    />
                  </div>
                </div>
              )}
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
                options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] ?? a }))}
                onSelect={(v) => filters.setAreaFilter(v)}
                onClear={() => filters.setAreaFilter("")}
              />
              <FilterChip
                label="Coverage"
                value={filters.coverageFilter}
                displayValue={
                  filters.coverageFilter === "unfilled"
                    ? "Needs crew"
                    : filters.coverageFilter === "filled"
                      ? "Fully covered"
                      : ""
                }
                options={[
                  { value: "unfilled", label: "Needs crew" },
                  { value: "filled", label: "Fully covered" },
                ]}
                onSelect={(v) => filters.setCoverageFilter(v)}
                onClear={() => filters.setCoverageFilter("")}
              />
              {filters.hasFilters && (
                <div className="pt-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-full text-xs font-medium"
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

        <ScheduleSourceSignal signal={sourceSignal} />
      </div>
    </OperationalToolbar>
  );
}
