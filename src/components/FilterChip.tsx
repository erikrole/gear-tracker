"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
            <button
              type="button"
              aria-label={`Clear ${label} filter`}
              className="ml-0.5 hover:text-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            >
              <X className="size-3" />
            </button>
          ) : (
            <ChevronDown className="size-3 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-auto min-w-[140px] p-0">
        <Command>
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No options</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => { onSelect(opt.value); setOpen(false); }}
                  className={opt.value === value ? "font-medium" : ""}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
