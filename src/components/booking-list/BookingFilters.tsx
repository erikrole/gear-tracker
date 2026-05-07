"use client";

import { SPORT_CODES } from "@/lib/sports";
import { FilterChip } from "@/components/FilterChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { XIcon } from "lucide-react";
import type { BookingListConfig, StatusOption, Location, FormUser } from "./types";

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

  return (
    <CardHeader className="!flex !flex-row items-center gap-2.5 flex-nowrap max-md:flex-wrap">
      <CardTitle style={{ margin: 0, whiteSpace: "nowrap" }}>
        {title}{" "}
        {config.labelPlural.toLowerCase()}
      </CardTitle>
      <Input
        id={`${config.kind.toLowerCase()}-booking-search`}
        name={`${config.kind.toLowerCase()}-booking-search`}
        type="text"
        className="flex-1 min-w-[120px] max-w-full max-md:flex-[1_1_100%] max-md:min-w-0"
        placeholder="Search by title or requester..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search bookings by title or requester"
      />
      <div className="flex gap-2 flex-nowrap items-center shrink-0 max-md:flex-wrap max-md:w-full">
        {specialFilter ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
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
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
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
    </CardHeader>
  );
}
