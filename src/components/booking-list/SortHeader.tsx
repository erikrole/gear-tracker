"use client";

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
      // First click: sort ascending (except startsAt defaults desc)
      onSort(toSortParam(sortKey, sortKey === "startsAt" ? "desc" : "asc"));
    } else {
      // Toggle direction
      onSort(toSortParam(sortKey, dir === "asc" ? "desc" : "asc"));
    }
  }

  return (
    <th onClick={handleClick}>
      <button type="button" className="appearance-none bg-transparent border-none cursor-pointer select-none w-full hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 focus-visible:rounded-sm" style={{ font: "inherit", fontWeight: "inherit", textAlign: "inherit", color: "inherit", padding: 0 }}>
        <span className="inline-flex items-center gap-1">
          {label}
          {isActive && (
            <span className="text-[10px] opacity-70">{dir === "asc" ? "\u2191" : "\u2193"}</span>
          )}
        </span>
      </button>
    </th>
  );
}
