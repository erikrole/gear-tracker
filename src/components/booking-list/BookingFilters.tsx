"use client";

import { SPORT_CODES } from "@/lib/sports";
import { FilterChip } from "@/components/FilterChip";
import { OperationalActiveFilterChips, OperationalToolbar, type OperationalActiveFilter } from "@/components/OperationalToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import type { BookingListConfig, Location, FormUser } from "./types";

export type BookingFiltersProps = {
  config: BookingListConfig;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  specialFilter: string;
  onSpecialFilterChange: (v: string) => void;
  sportFilter: string;
  onSportFilterChange: (v: string) => void;
  sportCodesInUse: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  locations: Location[];
  userFilter: string;
  onUserFilterChange: (v: string) => void;
  users: FormUser[];
};

export function BookingFilters({
  config,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  specialFilter,
  onSpecialFilterChange,
  sportFilter,
  onSportFilterChange,
  sportCodesInUse,
  locationFilter,
  onLocationFilterChange,
  locations,
  userFilter,
  onUserFilterChange,
  users,
}: BookingFiltersProps) {
  const title = statusFilter
    ? config.statusOptions.find((s) => s.value === statusFilter)?.label ?? "Filtered"
    : specialFilter
      ? specialFilter === "overdue" ? "Overdue" : "Due today"
      : config.scopeLabel ?? "All";
  const activeFilters: OperationalActiveFilter[] = [
    ...(specialFilter
      ? [{
        key: "special",
        label: `View: ${specialFilter === "overdue" ? "Overdue" : "Due today"}`,
        onRemove: () => onSpecialFilterChange(""),
      }]
      : []),
    ...(!specialFilter && statusFilter
      ? [{
        key: "status",
        label: `Status: ${config.statusOptions.find((s) => s.value === statusFilter)?.label ?? statusFilter}`,
        onRemove: () => onStatusFilterChange(""),
      }]
      : []),
    ...(config.hasSportFilter && sportFilter
      ? [{
        key: "sport",
        label: `Sport: ${sportFilter}`,
        onRemove: () => onSportFilterChange(""),
      }]
      : []),
    ...(locationFilter
      ? [{
        key: "location",
        label: `Location: ${locations.find((l) => l.id === locationFilter)?.name ?? locationFilter}`,
        onRemove: () => onLocationFilterChange(""),
      }]
      : []),
    ...(userFilter
      ? [{
        key: "user",
        label: `User: ${users.find((u) => u.id === userFilter)?.name ?? userFilter}`,
        onRemove: () => onUserFilterChange(""),
      }]
      : []),
  ];

  return (
    <div className="p-4">
      <OperationalToolbar>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="min-w-0 shrink-0 text-sm font-semibold text-foreground lg:w-[170px]">
            {title} {config.labelPlural.toLowerCase()}
          </div>
          <div className="relative min-w-0 flex-1">
            <Input
              id={`${config.kind.toLowerCase()}-booking-search`}
              name={`${config.kind.toLowerCase()}-booking-search`}
              type="text"
              className="peer h-10 pl-9 pr-9 text-base md:text-sm"
              placeholder="Search by title or requester"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search bookings by title or requester"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground/80 peer-disabled:opacity-50">
              <SearchIcon size={16} />
            </div>
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute inset-y-0 right-0 my-auto h-10 w-10 text-muted-foreground/80 hover:text-foreground"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                <XIcon size={14} />
              </Button>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {specialFilter ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 px-3 text-xs"
                onClick={() => onSpecialFilterChange("")}
                aria-label={`Clear ${specialFilter === "overdue" ? "overdue" : "due today"} filter`}
              >
                <span className="font-medium">Showing:</span>
                <span className="font-semibold">{specialFilter === "overdue" ? "Overdue" : "Due today"}</span>
                <XIcon className="size-3 opacity-60" aria-hidden="true" />
              </Button>
            ) : (
              <FilterChip
                label="Status"
                value={statusFilter}
                displayValue={config.statusOptions.find((s) => s.value === statusFilter)?.label}
                options={config.statusOptions}
                onSelect={(v) => onStatusFilterChange(v)}
                onClear={() => onStatusFilterChange("")}
              />
            )}
            {config.hasSportFilter && sportCodesInUse.length > 0 && (
              <FilterChip
                label="Sport"
                value={sportFilter}
                options={SPORT_CODES.map((s) => ({ value: s.code, label: s.code }))}
                onSelect={(v) => onSportFilterChange(v)}
                onClear={() => onSportFilterChange("")}
              />
            )}
            {locations.length > 1 && (
              <FilterChip
                label="Location"
                value={locationFilter}
                displayValue={locations.find((l) => l.id === locationFilter)?.name}
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
                onSelect={(v) => onLocationFilterChange(v)}
                onClear={() => onLocationFilterChange("")}
              />
            )}
            {users.length > 0 && (
              <FilterChip
                label="User"
                value={userFilter}
                displayValue={users.find((u) => u.id === userFilter)?.name}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                onSelect={(v) => onUserFilterChange(v)}
                onClear={() => onUserFilterChange("")}
              />
            )}
            {(statusFilter || sportFilter || locationFilter || userFilter || specialFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onStatusFilterChange("");
                  onSportFilterChange("");
                  onLocationFilterChange("");
                  onUserFilterChange("");
                  onSpecialFilterChange("");
                }}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
        <OperationalActiveFilterChips filters={activeFilters} />
      </OperationalToolbar>
    </div>
  );
}
