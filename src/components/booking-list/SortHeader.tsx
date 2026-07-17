"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <TableHead aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="group -ml-3 h-10 transition-[background-color,color,box-shadow,scale] active:scale-[0.96]"
        onClick={handleClick}
        aria-label={`Sort by ${label} ${!isActive || dir === "desc" ? "ascending" : "descending"}`}
      >
        {label}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={isActive ? dir : "unsorted"}
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="inline-flex items-center justify-center"
          >
            {!isActive ? (
              <ArrowUpDownIcon className="size-3.5 opacity-20 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-50" aria-hidden="true" />
            ) : dir === "asc" ? (
              <ArrowUpIcon className="size-4 text-foreground" aria-hidden="true" />
            ) : (
              <ArrowDownIcon className="size-4 text-foreground" aria-hidden="true" />
            )}
          </motion.span>
        </AnimatePresence>
      </Button>
    </TableHead>
  );
}
