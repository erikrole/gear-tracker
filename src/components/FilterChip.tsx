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
import { cn } from "@/lib/utils";

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
      <div
        className={cn(
          "relative inline-flex min-h-10 overflow-hidden rounded-md border border-border/60 bg-background/70 shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-[background-color,border-color,box-shadow]",
          active
            ? "border-primary/20 bg-primary/[0.06] text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-primary/60"
            : "text-muted-foreground hover:border-border hover:bg-foreground/[0.025]",
        )}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 max-w-[220px] min-w-0 gap-1.5 rounded-none border-0 px-3 text-xs shadow-none transition-[background-color,color,scale] hover:bg-foreground/[0.04] active:scale-[0.96]"
          >
            <span className="shrink-0 font-medium">{label}{active && ":"}</span>
            {active && <span className="truncate font-semibold text-foreground">{displayValue || value}</span>}
            {!active && <ChevronDown className="size-3 opacity-50" aria-hidden="true" />}
          </Button>
        </PopoverTrigger>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${label} filter`}
            className="size-10 rounded-none border-l border-border/50 text-muted-foreground shadow-none transition-[background-color,color,scale] hover:bg-primary/[0.08] hover:text-foreground active:scale-[0.96]"
            onClick={() => { onClear(); setOpen(false); }}
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        )}
      </div>
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
