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
  LOST:        { bg: "bg-[var(--red-bg)]",    dot: "bg-destructive",           label: "Lost" },
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
        const style = UNIT_STYLES[u.status] ?? UNIT_STYLES.AVAILABLE;
        const lastAlloc = u.allocations?.[0]?.bookingBulkItem?.booking;
        const lastUser = lastAlloc?.requester?.name;
        const isCheckedOut = u.status === "CHECKED_OUT";

        const cell = (
          <div
            className={[
              "flex flex-col items-center justify-center gap-0 px-1 py-1.5 rounded-md text-sm font-semibold select-none",
              style.bg,
              isCheckedOut || disabled ? "cursor-default opacity-70" : "cursor-context-menu",
            ].join(" ")}
            title={[
              `#${u.unitNumber} — ${style.label}`,
              lastUser && `Last: ${lastUser}`,
              isCheckedOut && "Check in first to change status",
            ].filter(Boolean).join(" · ")}
          >
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
                Mark Lost
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
