"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { BulkUnit } from "@/app/(app)/bulk-inventory/[id]/types";

const UNIT_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  AVAILABLE:   { bg: "bg-[var(--green-bg)]",  dot: "bg-[var(--green)]",       label: "Available" },
  CHECKED_OUT: { bg: "bg-[var(--blue-bg)]",   dot: "bg-[var(--blue)]",        label: "Checked out" },
  LOST:        { bg: "bg-[var(--red-bg)]",    dot: "bg-destructive",           label: "Missing" },
  RETIRED:     { bg: "bg-muted",              dot: "bg-muted-foreground",      label: "Retired" },
};

type Props = {
  units: BulkUnit[];
  onStatusChange: (unitNumber: number, newStatus: "AVAILABLE" | "LOST" | "RETIRED") => void;
  disabled?: boolean;
};

export function BulkUnitGrid({ units, onStatusChange, disabled = false }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
      {units.map((u) => {
        const style = UNIT_STYLES[u.status] ?? UNIT_STYLES["AVAILABLE"]!; // AVAILABLE always present in the map
        const lastAlloc = u.allocations?.[0]?.bookingBulkItem?.booking;
        const lastUser = lastAlloc?.requester?.name;
        const isCheckedOut = u.status === "CHECKED_OUT";
        const labelPrinted = !!u.labelPrintedAt;
        const needsLabel = !labelPrinted && u.status !== "RETIRED";
        const labelTitle = labelPrinted
          ? `Label printed ${new Date(u.labelPrintedAt!).toLocaleDateString()}`
          : needsLabel
            ? "Needs label"
            : null;

        const cell = (
          <div
            className={[
              "relative flex min-h-11 flex-col items-center justify-center gap-0 rounded-md px-1 py-2 text-sm font-semibold tabular-nums select-none",
              style.bg,
              isCheckedOut || disabled
                ? "cursor-default opacity-70"
                : "cursor-context-menu transition-[scale,box-shadow] hover:shadow-xs active:scale-[0.96]",
            ].join(" ")}
            title={[
              `#${u.unitNumber} — ${style.label}`,
              lastUser && `Last: ${lastUser}`,
              labelTitle,
              isCheckedOut && "Check in first to change status",
            ].filter(Boolean).join(" · ")}
          >
            {needsLabel && (
              <span
                aria-label="Needs label"
                className="absolute right-0.5 top-0.5 size-1 rounded-full bg-[var(--orange)]"
              />
            )}
            {labelPrinted && (
              <span
                aria-label="Label printed"
                className="absolute right-0.5 top-0.5 size-1 rounded-full bg-muted-foreground/60"
              />
            )}
            <div className="flex items-center gap-1">
              <div className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />
              <span style={{ fontFamily: "var(--font-mono)" }}>{u.unitNumber}</span>
            </div>
            {u.status === "LOST" && lastUser && (
              <div className="text-[9px] font-normal text-muted-foreground truncate max-w-full leading-tight">
                {lastUser.split(" ")[0]}
              </div>
            )}
          </div>
        );

        if (isCheckedOut || disabled) {
          return <div key={u.id}>{cell}</div>;
        }

        return (
          <ContextMenu key={u.id}>
            <ContextMenuTrigger asChild>{cell}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                disabled={u.status === "AVAILABLE"}
                onClick={() => onStatusChange(u.unitNumber, "AVAILABLE")}
              >
                Mark Available
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={u.status === "LOST"}
                className="text-destructive focus:text-destructive"
                onClick={() => onStatusChange(u.unitNumber, "LOST")}
              >
                Mark Missing
              </ContextMenuItem>
              <ContextMenuItem
                disabled={u.status === "RETIRED"}
                onClick={() => onStatusChange(u.unitNumber, "RETIRED")}
              >
                Mark Retired
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
