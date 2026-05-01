"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  Tag,
  Wrench,
  Package,
  Archive,
  Trash2,
  ChevronDown,
  Star,
  StarOff,
} from "lucide-react";

type Location = { id: string; name: string };
type Kit = { id: string; name: string };

export function BulkActionBar({
  count,
  locations,
  categoryOptions,
  kits = [],
  busy,
  error,
  userRole,
  onAction,
  onClear,
  onSelectAllMatching,
  selectAllMatchingTotal,
}: {
  count: number;
  locations: Location[];
  categoryOptions: { value: string; label: string }[];
  kits?: Kit[];
  busy: boolean;
  error: string;
  userRole: string;
  onAction: (action: string, payload?: Record<string, string | null>) => void;
  onClear: () => void;
  onSelectAllMatching?: () => void;
  selectAllMatchingTotal?: number;
}) {
  const [retireOpen, setRetireOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canDelete = userRole === "ADMIN";

  return (
    <div className="flex items-center gap-2 w-full flex-wrap">
      <span className="text-sm font-semibold" role="status" aria-live="polite">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
        Clear
      </Button>
      {onSelectAllMatching && selectAllMatchingTotal !== undefined && selectAllMatchingTotal > count && (
        <Button variant="link" size="sm" onClick={onSelectAllMatching} disabled={busy} className="h-auto px-1">
          Select all {selectAllMatchingTotal} matching
        </Button>
      )}
      <div className="flex-1" />

      {/* Favorites — available to all roles */}
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction("favorite")} className="gap-1.5">
        <Star className="size-3.5" />
        Star
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction("unfavorite")} className="gap-1.5">
        <StarOff className="size-3.5" />
        Unstar
      </Button>

      {userRole !== "STUDENT" && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            Actions
            <ChevronDown className="ml-1.5 size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Move location */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MapPin className="mr-2 size-4" />
              Move location
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
              {locations.map((l) => (
                <DropdownMenuItem
                  key={l.id}
                  onClick={() => onAction("move_location", { locationId: l.id })}
                >
                  {l.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Change category */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="mr-2 size-4" />
              Change category
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
              <DropdownMenuItem
                className="italic"
                onClick={() => onAction("change_category", { categoryId: null })}
              >
                None
              </DropdownMenuItem>
              {categoryOptions.map((c) => (
                <DropdownMenuItem
                  key={c.value}
                  onClick={() => onAction("change_category", { categoryId: c.value })}
                >
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Maintenance toggle */}
          <DropdownMenuItem onClick={() => onAction("maintenance")}>
            <Wrench className="mr-2 size-4" />
            Maintenance
          </DropdownMenuItem>

          {/* Add to kit */}
          {kits.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Package className="mr-2 size-4" />
                Add to kit
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                {kits.map((k) => (
                  <DropdownMenuItem
                    key={k.id}
                    onClick={() => onAction("add_to_kit", { kitId: k.id })}
                  >
                    {k.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />

          {/* Retire */}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setRetireOpen(true)}
          >
            <Archive className="mr-2 size-4" />
            Retire
          </DropdownMenuItem>

          {/* Delete (admin only) */}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete permanently
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>}

      {/* Retire confirmation */}
      <AlertDialog open={retireOpen} onOpenChange={setRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retire {count} item{count > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently retire{" "}
              {count === 1 ? "1 item" : `${count} items`}.
              Retired items are hidden from active inventory and cannot be checked out or reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onAction("retire")}
              disabled={busy}
            >
              {busy ? "Retiring…" : "Retire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} item{count > 1 ? "s" : ""} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              {count === 1 ? "1 item" : `${count} items`} and all associated
              history (booking records, scan logs, check-in reports). This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onAction("delete")}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {busy && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Spinner className="size-3.5" /> Processing…
        </span>
      )}
      {error && <span className="sr-only" role="alert">{error}</span>}
    </div>
  );
}
