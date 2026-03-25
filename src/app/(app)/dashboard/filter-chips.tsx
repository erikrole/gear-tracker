"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkIcon, BookmarkPlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type FilterPreset = {
  id: string;
  label: string;
  sport: string | null;
  location: string | null;
};

const PRESETS_KEY = "gear-tracker:filter-presets";

function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function presetLabel(sport: string | null, location: string | null): string {
  if (sport && location) return `${sport} \u00B7 ${location}`;
  return sport || location || "Custom";
}

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
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!activeSport && !activeLocation) return;
    const label = presetLabel(activeSport, activeLocation);
    // Don't save duplicate
    const existing = loadPresets();
    if (existing.some((p) => p.sport === activeSport && p.location === activeLocation)) return;
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      label,
      sport: activeSport,
      location: activeLocation,
    };
    const updated = [...existing, preset];
    savePresets(updated);
    setPresets(updated);
  }, [activeSport, activeLocation]);

  const handleDeletePreset = useCallback((id: string) => {
    const updated = loadPresets().filter((p) => p.id !== id);
    savePresets(updated);
    setPresets(updated);
  }, []);

  const handleApplyPreset = useCallback((preset: FilterPreset) => {
    // Apply both filters at once via URL
    const params = new URLSearchParams();
    if (preset.sport) params.set("sport", preset.sport);
    if (preset.location) params.set("location", preset.location);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
    // Trigger re-render by setting both
    setActiveSport(preset.sport);
    setActiveLocation(preset.location);
  }, [setActiveSport, setActiveLocation]);

  const isCurrentPresetSaved = presets.some(
    (p) => p.sport === activeSport && p.location === activeLocation
  );

  if (availableSports.length <= 1 && availableLocations.length <= 1 && presets.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Filter chips row */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
          <>
            {!isCurrentPresetSaved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={handleSavePreset}
                  >
                    <BookmarkPlusIcon className="size-3 mr-1" />
                    Save view
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save this filter combination</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground"
              onClick={clearFilters}
            >
              <XIcon className="size-3 mr-1" />
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Saved presets row */}
      {presets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[0.65rem] text-muted-foreground uppercase tracking-wider font-medium mr-0.5">
            <BookmarkIcon className="size-3 inline-block mr-0.5 -mt-0.5" />
            Saved
          </span>
          {presets.map((preset) => {
            const isActive = preset.sport === activeSport && preset.location === activeLocation;
            return (
              <Badge
                key={preset.id}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer gap-1 pr-1 select-none"
                onClick={() => {
                  if (isActive) {
                    clearFilters();
                  } else {
                    handleApplyPreset(preset);
                  }
                }}
              >
                {preset.label}
                <button
                  className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePreset(preset.id);
                  }}
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
