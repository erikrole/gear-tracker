"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Location = { id: string; name: string };

export function BulkActionBar({
  count,
  locations,
  categoryOptions,
  busy,
  error,
  onAction,
  onClear,
}: {
  count: number;
  locations: Location[];
  categoryOptions: { value: string; label: string }[];
  busy: boolean;
  error: string;
  onAction: (action: string, payload?: Record<string, string | null>) => void;
  onClear: () => void;
}) {
  const [retireOpen, setRetireOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 w-full flex-wrap">
      <span className="text-sm font-semibold">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
        Clear
      </Button>
      <div className="flex-1" />

      {/* Move location */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            Move location
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto min-w-[180px] max-h-[240px] overflow-y-auto p-1"
        >
          {locations.map((l) => (
            <Button
              key={l.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              onClick={() => onAction("move_location", { locationId: l.id })}
            >
              {l.name}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Change category */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            Change category
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto min-w-[200px] max-h-[240px] overflow-y-auto p-1"
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal italic"
            onClick={() => onAction("change_category", { categoryId: null })}
          >
            None
          </Button>
          {categoryOptions.map((c) => (
            <Button
              key={c.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              onClick={() => onAction("change_category", { categoryId: c.value })}
            >
              {c.label}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction("maintenance")}
        disabled={busy}
      >
        Maintenance
      </Button>

      <AlertDialog open={retireOpen} onOpenChange={setRetireOpen}>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setRetireOpen(true)}
          disabled={busy}
        >
          Retire
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retire {count} item{count > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark{" "}
              {count === 1 ? "this item" : `these ${count} items`} as retired.
              Retired items are hidden from active inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onAction("retire")}
            >
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {busy && <span className="text-sm text-muted">Processing...</span>}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
