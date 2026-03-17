import { FilterChip } from "@/components/FilterChip";
import type { Location, Role } from "./types";
import { ROLE_OPTIONS } from "./types";

export default function UserFilters({
  search,
  onSearchChange,
  roleFilter,
  onRoleChange,
  locationFilter,
  onLocationChange,
  locations,
  onClearAll,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  roleFilter: string;
  onRoleChange: (v: string) => void;
  locationFilter: string;
  onLocationChange: (v: string) => void;
  locations: Location[];
  onClearAll: () => void;
}) {
  const hasFilters = !!roleFilter || !!locationFilter;
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="card-header filter-chip-bar">
      <input
        className="form-input filter-chip-search"
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search users"
      />
      <div className="filter-chips">
        <FilterChip
          label="Role"
          value={roleFilter}
          options={ROLE_OPTIONS}
          onSelect={(v) => onRoleChange(v as Role)}
          onClear={() => onRoleChange("")}
        />
        <FilterChip
          label="Location"
          value={locationFilter}
          displayValue={locations.find((l) => l.id === locationFilter)?.name}
          options={locationOptions}
          onSelect={onLocationChange}
          onClear={() => onLocationChange("")}
        />
        {hasFilters && (
          <button type="button" className="filter-chip-clear-all" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
