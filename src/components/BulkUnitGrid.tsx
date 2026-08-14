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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
      {units.map((u) => {
        const style = UNIT_STYLES[u.status] ?? UNIT_STYLES["AVAILABLE"]!; // AVAILABLE always present in the map
        const lastAlloc = u.allocations?.[0]?.bookingBulkItem?.booking;
        const lastUser = lastAlloc?.requester?.name;
        const isCheckedOut = u.status === "CHECKED_OUT";
        const labelPrintedAt = u.labelPrintedAt ? new Date(u.labelPrintedAt) : null;
        const labelText = labelPrintedAt
          ? `Label printed ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(labelPrintedAt)}`
          : u.status === "RETIRED"
            ? "Label not needed"
            : "Needs label";

        const cell = (
          <div
            className={[
              "flex flex-col items-center justify-center gap-0 px-1 py-1.5 rounded-md text-sm font-semibold select-none",
              style.bg,
              isCheckedOut || disabled ? "cursor-default opacity-70" : "cursor-context-menu",
            ].join(" ")}
            title={[
              `#${u.unitNumber} — ${style.label}`,
              labelText,
              lastUser && `Last: ${lastUser}`,
              isCheckedOut && "Check in first to change status",
            ].filter(Boolean).join(" · ")}
            aria-label={`Unit ${u.unitNumber}, ${style.label}, ${labelText}`}
          >
            <div className="flex items-center gap-1">
              <div className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />
              <span style={{ fontFamily: "var(--font-mono)" }}>{u.unitNumber}</span>
            </div>
            <div
              aria-hidden="true"
              className={[
                "mt-1 h-1 w-5 rounded-full",
                labelPrintedAt ? "bg-primary/70" : u.status === "RETIRED" ? "bg-muted-foreground/30" : "bg-orange-400",
              ].join(" ")}
            />
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
