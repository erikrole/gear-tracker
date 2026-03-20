"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function KebabMenu({
  onRename,
  onAddSub,
  onDelete,
  hasItems,
  hasChildren,
}: {
  onRename: () => void;
  onAddSub: () => void;
  onDelete: () => void;
  hasItems: boolean;
  hasChildren: boolean;
}) {
  const canDelete = !hasItems && !hasChildren;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Category actions"
          onClick={(e) => e.stopPropagation()}
        >
          &#8942;
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddSub}>
          Add subcategory
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canDelete}
          onSelect={onDelete}
          title={hasItems ? "Remove linked items first" : hasChildren ? "Remove subcategories first" : ""}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
