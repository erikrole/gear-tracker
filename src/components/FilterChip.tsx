"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function FilterChip({
  label,
  value,
  displayValue,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value: string;
  displayValue?: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`filter-chip ${active ? "filter-chip-active" : ""}`}
        >
          <span className="filter-chip-label">{label}{active && ":"}</span>
          {active && <span className="filter-chip-value">{displayValue || value}</span>}
          {active ? (
            <span
              className="filter-chip-clear"
              onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            >&times;</span>
          ) : (
            <span className="filter-chip-chevron">{"\u25BE"}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto min-w-[140px] max-h-[240px] overflow-y-auto p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none cursor-default hover:bg-accent hover:text-accent-foreground ${opt.value === value ? "bg-accent text-accent-foreground font-medium" : ""}`}
            onClick={() => { onSelect(opt.value); setOpen(false); }}
          >
            {opt.label}
          </button>
        ))}
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No options</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
