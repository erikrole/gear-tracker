"use client";

import { MoreVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { OperationalRowActions } from "@/components/OperationalRowActions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
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
    <OperationalRowActions
      label="Category actions"
      icon={<MoreVerticalIcon className="size-4" aria-hidden="true" />}
    >
      <DropdownMenuItem onSelect={onRename}>
        <PencilIcon className="size-4" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onAddSub}>
        <PlusIcon className="size-4" />
        Add subcategory
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={!canDelete}
        onSelect={onDelete}
        title={hasItems ? "Remove linked items first" : hasChildren ? "Remove subcategories first" : ""}
      >
        <Trash2Icon className="size-4" />
        Delete
      </DropdownMenuItem>
    </OperationalRowActions>
  );
}
