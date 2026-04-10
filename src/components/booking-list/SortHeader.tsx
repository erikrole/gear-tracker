"use client";

import { TableHead } from "@/components/ui/table";
import { parseSortParam, toSortParam, type SortKey } from "./types";

export function SortHeader({ label, sortKey, currentSort, onSort }: {
  label: string;
  sortKey: SortKey;
  currentSort: string;
  onSort: (param: string) => void;
}) {
  const parsed = parseSortParam(currentSort);
  const isActive = parsed?.key === sortKey;
  const dir = isActive ? parsed.dir : null;

  function handleClick() {
    if (!isActive) {
      onSort(toSortParam(sortKey, sortKey === "startsAt" ? "desc" : "asc"));
    } else {
      onSort(toSortParam(sortKey, dir === "asc" ? "desc" : "asc"));
    }
  }

  return (
    <TableHead onClick={handleClick} className="cursor-pointer select-none hover:text-foreground transition-colors">
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-[10px] opacity-70">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </TableHead>
  );
}
