"use client";

import { type RefObject } from "react";
import { SearchIcon, Star, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FacetedFilter } from "../faceted-filter";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "CHECKED_OUT", label: "Checked out" },
  { value: "RESERVED", label: "Reserved" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "RETIRED", label: "Retired" },
];

type Location = { id: string; name: string };
type Department = { id: string; name: string };

export function ItemsToolbar({
  searchInputRef,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  locationFilter,
  onLocationFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  brandFilter,
  onBrandFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  showAccessories,
  onShowAccessoriesChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  itemType,
  onItemTypeChange,
  hasActiveFilters,
  onClearAllFilters,
  locations,
  departments,
  categoryOptions,
  brands,
}: {
  searchInputRef?: RefObject<HTMLInputElement | null>;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: Set<string>;
  onStatusFilterChange: (value: Set<string>) => void;
  locationFilter: Set<string>;
  onLocationFilterChange: (value: Set<string>) => void;
  categoryFilter: Set<string>;
  onCategoryFilterChange: (value: Set<string>) => void;
  brandFilter: Set<string>;
  onBrandFilterChange: (value: Set<string>) => void;
  departmentFilter: Set<string>;
  onDepartmentFilterChange: (value: Set<string>) => void;
  showAccessories: boolean;
  onShowAccessoriesChange: (value: boolean) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  itemType: "all" | "serialized" | "bulk";
  onItemTypeChange: (value: "all" | "serialized" | "bulk") => void;
  hasActiveFilters: boolean;
  onClearAllFilters: () => void;
  locations: Location[];
  departments: Department[];
  categoryOptions: { value: string; label: string }[];
  brands: string[];
}) {
  return (
    <>
      {/* Search input with icon */}
      <div className="relative w-full sm:w-48">
        <Input
          ref={searchInputRef}
          className="peer pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search items"
          type="text"
          aria-label="Search items"
        />
        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
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
            <XIcon size={14} />
          </Button>
        )}
      </div>

      {/* Faceted multi-select filters */}
      <FacetedFilter
        title="Category"
        options={categoryOptions}
        selected={categoryFilter}
        onSelectionChange={onCategoryFilterChange}
      />
      <FacetedFilter
        title="Status"
        options={STATUS_OPTIONS}
        selected={statusFilter}
        onSelectionChange={onStatusFilterChange}
      />
      <FacetedFilter
        title="Location"
        options={locations.map((l) => ({ value: l.id, label: l.name }))}
        selected={locationFilter}
        onSelectionChange={onLocationFilterChange}
      />
      {departments.length > 0 && (
        <FacetedFilter
          title="Department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          selected={departmentFilter}
          onSelectionChange={onDepartmentFilterChange}
        />
      )}
      {brands.length > 0 && (
        <FacetedFilter
          title="Brand"
          options={brands.map((b) => ({ value: b, label: b }))}
          selected={brandFilter}
          onSelectionChange={onBrandFilterChange}
        />
      )}
      <Button
        variant={favoritesOnly ? "default" : "outline"}
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        aria-pressed={favoritesOnly}
        aria-label="Filter to favorites only"
      >
        <Star className={`size-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
        Favorites
      </Button>
      <ToggleGroup
        type="single"
        value={itemType}
        onValueChange={(v) => v && onItemTypeChange(v as "all" | "serialized" | "bulk")}
        className="shrink-0"
        aria-label="Item type filter"
      >
        <ToggleGroupItem value="all" className="text-xs px-2.5">All</ToggleGroupItem>
        <ToggleGroupItem value="serialized" className="text-xs px-2.5">Serialized</ToggleGroupItem>
        <ToggleGroupItem value="bulk" className="text-xs px-2.5">Bulk</ToggleGroupItem>
      </ToggleGroup>
      <div className="flex items-center gap-1.5">
        <Switch
          id="show-accessories"
          checked={showAccessories}
          onCheckedChange={onShowAccessoriesChange}
          className="h-4 w-7 [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3"
        />
        <Label htmlFor="show-accessories" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
          Accessories only
        </Label>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClearAllFilters}>
          Clear filters
          <XIcon className="ml-2 size-4" />
        </Button>
      )}
    </>
  );
}
