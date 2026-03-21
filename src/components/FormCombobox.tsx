"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import type { CategoryOption } from "@/types/category";

// ── Simple flat combobox ──

interface ComboboxOption {
  value: string;
  label: string;
}

interface FormComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Whether to show a clear/none option */
  allowClear?: boolean;
  /** Whether the combobox is disabled (renders plain text) */
  disabled?: boolean;
}

export function FormCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyLabel = "No results.",
  allowClear = false,
  disabled = false,
}: FormComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (disabled) {
    return <span className="text-sm">{selected?.label || "\u2014"}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-sm font-normal"
        >
          {selected ? (
            selected.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value=" "
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground">&mdash;</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === opt.value ? "opacity-100" : "opacity-0")} />
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

// ── Grouped category combobox ──

interface CategoryComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: CategoryOption[];
  /** Whether to show a clear/none option */
  allowClear?: boolean;
  /** Whether to show a "+ Create new category" option */
  allowCreate?: boolean;
  /** Callback when user clicks create — parent handles the creation flow */
  onCreateRequested?: () => void;
  /** Whether the combobox is disabled (renders plain text) */
  disabled?: boolean;
  /** Display label when disabled and no value is selected */
  disabledLabel?: string;
}

export function CategoryCombobox({
  value,
  onValueChange,
  categories,
  allowClear = false,
  allowCreate = false,
  onCreateRequested,
  disabled = false,
  disabledLabel,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);

  const parents = categories.filter((c) => !c.parentId);
  const selectedCat = categories.find((c) => c.id === value);

  if (disabled) {
    return <span className="text-sm">{disabledLabel || selectedCat?.name || "\u2014"}</span>;
  }

  // Build grouped structure
  const parentMap = new Map<string, CategoryOption[]>();
  const topLevel: CategoryOption[] = [];

  for (const cat of categories) {
    if (cat.parentId) {
      const children = parentMap.get(cat.parentId) || [];
      children.push(cat);
      parentMap.set(cat.parentId, children);
    }
  }

  for (const cat of categories) {
    if (!cat.parentId && !parentMap.has(cat.id)) {
      topLevel.push(cat);
    }
  }

  const parentCategories = categories.filter((c) => !c.parentId && parentMap.has(c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-sm font-normal"
        >
          {selectedCat ? (
            selectedCat.name
          ) : (
            <span className="text-muted-foreground">Select category</span>
          )}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            {allowClear && (
              <>
                <CommandGroup>
                  <CommandItem
                    value=" "
                    onSelect={() => {
                      onValueChange("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        !value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">&mdash;</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {/* Top-level categories (no children) */}
            {topLevel.length > 0 && (
              <CommandGroup heading={parentCategories.length > 0 ? "Categories" : undefined}>
                {topLevel.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => {
                      onValueChange(cat.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === cat.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {cat.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {/* Grouped categories (parent → children) */}
            {parentCategories.map((parent) => (
              <CommandGroup key={parent.id} heading={parent.name}>
                {(parentMap.get(parent.id) || []).map((child) => (
                  <CommandItem
                    key={child.id}
                    value={`${parent.name} ${child.name}`}
                    onSelect={() => {
                      onValueChange(child.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === child.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {child.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {allowCreate && onCreateRequested && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      onCreateRequested();
                    }}
                  >
                    + Create new category
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Bulk SKU combobox ──

export type BulkSkuOption = {
  id: string;
  name: string;
  location: { name: string };
  balances: { onHandQuantity: number }[];
  categoryRel: { name: string } | null;
};

interface BulkSkuComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  skus: BulkSkuOption[];
}

export function BulkSkuCombobox({
  value,
  onValueChange,
  skus,
}: BulkSkuComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = skus.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-sm font-normal"
        >
          {selected ? (
            selected.name
          ) : (
            <span className="text-muted-foreground">Select a bulk item</span>
          )}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, location, category..." />
          <CommandList>
            <CommandEmpty>No bulk items found.</CommandEmpty>
            <CommandGroup>
              {skus.map((sku) => {
                const qty = sku.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
                const searchLabel = [sku.name, sku.location.name, sku.categoryRel?.name].filter(Boolean).join(" ");
                return (
                  <CommandItem
                    key={sku.id}
                    value={searchLabel}
                    onSelect={() => {
                      onValueChange(sku.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 size-4", value === sku.id ? "opacity-100" : "opacity-0")} />
                    <span>
                      {sku.name} — {qty} on hand ({sku.location.name})
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
