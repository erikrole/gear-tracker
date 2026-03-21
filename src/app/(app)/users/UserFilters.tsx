import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "./types";
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          className="h-8 max-w-sm"
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search users"
        />
        <div className="flex items-center gap-2">
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
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
