"use client";

import { SPORT_CODES } from "@/lib/sports";
import { FilterChip } from "@/components/FilterChip";
import { Input } from "@/components/ui/input";
import { CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <CardHeader className="filter-chip-bar">
      <CardTitle style={{ margin: 0, whiteSpace: "nowrap" }}>All {config.labelPlural.toLowerCase()}</CardTitle>
      <Input
        type="text"
        className="filter-chip-search"
        placeholder="Search by title or requester..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="filter-chips">
        {specialFilter ? (
          <button
            type="button"
            className="filter-chip filter-chip-active"
            onClick={() => onSpecialFilterChange("")}
          >
            <span className="filter-chip-label">Showing:</span>
            <span className="filter-chip-value">{specialFilter === "overdue" ? "Overdue" : "Due today"}</span>
            <span className="filter-chip-clear">&times;</span>
          </button>
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
          <button
            type="button"
            className="filter-chip-clear-all"
            onClick={() => {
              onStatusFilterChange("");
              onSportFilterChange("");
              onLocationFilterChange("");
              onUserFilterChange("");
              onSpecialFilterChange("");
            }}
          >
            Clear all
          </button>
        )}
      </div>
    </CardHeader>
  );
}
