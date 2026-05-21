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
          "inline-flex h-10 overflow-hidden rounded-md border border-input bg-background shadow-xs",
          active ? "bg-muted/80 border-border" : "text-muted-foreground",
        )}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-full gap-1 rounded-none border-0 px-3 text-xs shadow-none hover:bg-muted/60"
          >
            <span className="font-medium">{label}{active && ":"}</span>
            {active && <span className="font-semibold text-foreground">{displayValue || value}</span>}
            {!active && <ChevronDown className="size-3 opacity-50" />}
          </Button>
        </PopoverTrigger>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${label} filter`}
            className="h-full w-10 rounded-none border-l border-border/50 text-muted-foreground shadow-none transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96]"
            onClick={() => { onClear(); setOpen(false); }}
          >
            <X className="size-3" />
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
