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
    <th className="sort-header" onClick={handleClick}>
      <span className="sort-header-inner">
        {label}
        {isActive && (
          <span className="sort-arrow">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );
}
