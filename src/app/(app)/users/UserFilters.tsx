import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchIcon, SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "./types";
import { AREA_LABELS, ROLE_OPTIONS, STUDENT_YEAR_OPTIONS } from "./types";
import { SPORT_CODES, sportLabel } from "@/lib/sports";

export default function UserFilters({
  search,
  onSearchChange,
  roleFilter,
  onRoleChange,
  locationFilter,
  onLocationChange,
  locations,
  yearFilter,
  onYearChange,
  sportFilter,
  onSportChange,
  areaFilter,
  onAreaChange,
  showInactive,
  onShowInactiveChange,
  onClearAll,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  roleFilter: string;
  onRoleChange: (v: string) => void;
  locationFilter: string;
  onLocationChange: (v: string) => void;
  locations: Location[];
  yearFilter: string;
  onYearChange: (v: string) => void;
  sportFilter: string;
  onSportChange: (v: string) => void;
  areaFilter: string;
  onAreaChange: (v: string) => void;
  showInactive: boolean;
  onShowInactiveChange: (v: boolean) => void;
  onClearAll: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(
    !!roleFilter || !!locationFilter || !!yearFilter || !!sportFilter || !!areaFilter || showInactive,
  );
  const previousFilterCountRef = useRef(0);
  const activeFilterCount =
    (roleFilter ? 1 : 0) +
    (locationFilter ? 1 : 0) +
    (areaFilter ? 1 : 0) +
    (yearFilter ? 1 : 0) +
    (sportFilter ? 1 : 0) +
    (showInactive ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  useEffect(() => {
    if (previousFilterCountRef.current > 0 && activeFilterCount === 0) {
      setFiltersOpen(false);
    }
    previousFilterCountRef.current = activeFilterCount;
  }, [activeFilterCount]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border/60 bg-card/70 p-2 shadow-xs">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            id="users-search"
            name="users-search"
            className="peer h-9 pl-9 pr-9 text-base md:text-sm"
            type="text"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search users"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground/80 peer-disabled:opacity-50">
            <SearchIcon size={16} />
          </div>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute inset-y-0 right-1.5 my-auto text-muted-foreground/80 hover:text-foreground"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filtersOpen || activeFilterCount > 0 ? "secondary" : "outline"}
            size="sm"
            className="h-9 gap-1.5 active:scale-[0.96] transition-transform"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-sm bg-background px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 active:scale-[0.96] transition-transform" onClick={onClearAll}>
              Clear
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
          <Select value={roleFilter || "__all__"} onValueChange={(v) => onRoleChange(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All roles</SelectItem>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter || "__all__"} onValueChange={(v) => onLocationChange(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={areaFilter || "__all__"} onValueChange={(v) => onAreaChange(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="All areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All areas</SelectItem>
              {Object.entries(AREA_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter || "__all__"} onValueChange={(v) => onYearChange(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All years</SelectItem>
              {STUDENT_YEAR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sportFilter || "__all__"} onValueChange={(v) => onSportChange(v === "__all__" ? "" : v)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="All sports" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__all__">All sports</SelectItem>
              {SPORT_CODES.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={(v) => onShowInactiveChange(!!v)}
            />
            <Label htmlFor="show-inactive" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              Show inactive
            </Label>
          </div>
        </div>
      )}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {roleFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onRoleChange("")}>
              Role: {ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label}
              <X className="size-3" />
            </Button>
          )}
          {locationFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onLocationChange("")}>
              Location: {locations.find((l) => l.id === locationFilter)?.name}
              <X className="size-3" />
            </Button>
          )}
          {areaFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onAreaChange("")}>
              Area: {AREA_LABELS[areaFilter] ?? areaFilter}
              <X className="size-3" />
            </Button>
          )}
          {yearFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onYearChange("")}>
              Year: {STUDENT_YEAR_OPTIONS.find((o) => o.value === yearFilter)?.label ?? yearFilter}
              <X className="size-3" />
            </Button>
          )}
          {sportFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onSportChange("")}>
              Sport: {sportLabel(sportFilter)}
              <X className="size-3" />
            </Button>
          )}
          {showInactive && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs active:scale-[0.96] transition-transform" onClick={() => onShowInactiveChange(false)}>
              Showing inactive
              <X className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
