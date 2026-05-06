"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { SearchIcon, SlidersHorizontal, Star, XIcon } from "lucide-react";
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
  const [filtersOpen, setFiltersOpen] = useState(hasActiveFilters);
  const previousActiveFilterCountRef = useRef(0);
  const activeFilterCount =
    statusFilter.size +
    locationFilter.size +
    categoryFilter.size +
    brandFilter.size +
    departmentFilter.size +
    (showAccessories ? 1 : 0);

  useEffect(() => {
    if (previousActiveFilterCountRef.current > 0 && activeFilterCount === 0) {
      setFiltersOpen(false);
    }
    previousActiveFilterCountRef.current = activeFilterCount;
  }, [activeFilterCount]);

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border/60 bg-card/70 p-2 shadow-xs">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            id="items-search"
            name="items-search"
            ref={searchInputRef}
            className="peer h-9 pl-9 pr-9 text-base md:text-sm"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tag, model, serial, location"
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border/60 bg-background p-0.5">
            <ToggleGroup
              type="single"
              value={itemType}
              onValueChange={(v) => v && onItemTypeChange(v as "all" | "serialized" | "bulk")}
              className="shrink-0"
              aria-label="Item type filter"
            >
              <ToggleGroupItem value="all" className="h-8 px-3 text-xs">All</ToggleGroupItem>
              <ToggleGroupItem value="serialized" className="h-8 px-3 text-xs">Serialized</ToggleGroupItem>
              <ToggleGroupItem value="bulk" className="h-8 px-3 text-xs">Bulk</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="hidden h-6 w-px bg-border/70 lg:block" aria-hidden="true" />
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5 active:scale-[0.96] transition-transform"
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            aria-pressed={favoritesOnly}
            aria-label="Filter to favorites only"
          >
            <Star className={`size-3.5 ${favoritesOnly ? "fill-current" : ""}`} />
            Favorites
          </Button>
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
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 active:scale-[0.96] transition-transform" onClick={onClearAllFilters}>
              Clear
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
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
          <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-3">
            <Switch
              id="show-accessories"
              checked={showAccessories}
              onCheckedChange={onShowAccessoriesChange}
              className="h-4 w-7 [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3"
            />
            <Label htmlFor="show-accessories" className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground">
              Attachments only
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
