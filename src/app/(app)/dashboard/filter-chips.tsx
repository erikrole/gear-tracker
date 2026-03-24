"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  availableSports: string[];
  availableLocations: string[];
  activeSport: string | null;
  activeLocation: string | null;
  setActiveSport: (sport: string | null) => void;
  setActiveLocation: (loc: string | null) => void;
  clearFilters: () => void;
  hasActiveFilter: boolean;
};

export function FilterChips({
  availableSports,
  availableLocations,
  activeSport,
  activeLocation,
  setActiveSport,
  setActiveLocation,
  clearFilters,
  hasActiveFilter,
}: Props) {
  if (availableSports.length <= 1 && availableLocations.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {availableSports.length > 1 && availableSports.map((code) => (
        <Button
          key={`sport-${code}`}
          variant={activeSport === code ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => setActiveSport(activeSport === code ? null : code)}
        >
          {code}
        </Button>
      ))}
      {availableSports.length > 1 && availableLocations.length > 1 && (
        <span className="w-px h-5 bg-border mx-0.5" />
      )}
      {availableLocations.length > 1 && availableLocations.map((name) => (
        <Button
          key={`loc-${name}`}
          variant={activeLocation === name ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => setActiveLocation(activeLocation === name ? null : name)}
        >
          {name}
        </Button>
      ))}
      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 text-muted-foreground"
          onClick={clearFilters}
        >
          <XIcon className="size-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
