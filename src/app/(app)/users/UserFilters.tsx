import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
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
  const hasFilters =
    !!roleFilter || !!locationFilter || !!yearFilter || !!sportFilter || !!areaFilter;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="h-8 sm:max-w-sm"
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search users"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={roleFilter || "__all__"} onValueChange={(v) => onRoleChange(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[130px]">
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
            <SelectTrigger className="h-8 w-[150px]">
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
            <SelectTrigger className="h-8 w-[130px]">
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
            <SelectTrigger className="h-8 w-[130px]">
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
            <SelectTrigger className="h-8 w-[150px]">
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
      </div>
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {roleFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onRoleChange("")}>
              Role: {ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label}
              <X className="size-3" />
            </Button>
          )}
          {locationFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onLocationChange("")}>
              Location: {locations.find((l) => l.id === locationFilter)?.name}
              <X className="size-3" />
            </Button>
          )}
          {areaFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onAreaChange("")}>
              Area: {AREA_LABELS[areaFilter] ?? areaFilter}
              <X className="size-3" />
            </Button>
          )}
          {yearFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onYearChange("")}>
              Year: {STUDENT_YEAR_OPTIONS.find((o) => o.value === yearFilter)?.label ?? yearFilter}
              <X className="size-3" />
            </Button>
          )}
          {sportFilter && (
            <Button variant="secondary" size="sm" className="h-7 gap-1 text-xs" onClick={() => onSportChange("")}>
              Sport: {sportLabel(sportFilter)}
              <X className="size-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
