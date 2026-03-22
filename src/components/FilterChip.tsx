"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";

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
        <Button
          variant="outline"
          size="sm"
          className={`h-7 gap-1 text-xs rounded-full ${
            active
              ? "bg-muted/80 border-border"
              : "text-muted-foreground"
          }`}
        >
          <span className="font-medium">{label}{active && ":"}</span>
          {active && <span className="font-semibold text-foreground">{displayValue || value}</span>}
          {active ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label} filter`}
              className="ml-0.5 hover:text-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); setOpen(false); } }}
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3 opacity-50" />
          )}
        </Button>
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
