"use client";

import { useEffect, useRef } from "react";
import { getAllowedBookingActions } from "@/lib/booking-actions";
import type { BookingItem, BookingListConfig } from "./types";

export type BookingContextMenuProps = {
  ctxMenu: { x: number; y: number; item: BookingItem } | null;
  onClose: () => void;
  onViewDetails: (id: string) => void;
  onExtend: (bookingId: string, days: number) => void;
  extendingId: string | null;
  currentUserId: string;
  currentUserRole: string;
  config: BookingListConfig;
  items: BookingItem[];
  reload: () => Promise<void>;
};

const menuItemClass =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left outline-hidden select-none bg-transparent border-none cursor-default hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

export function BookingContextMenu({
  ctxMenu,
  onClose,
  onViewDetails,
  onExtend,
  extendingId,
  currentUserId,
  currentUserRole,
  config,
  items,
  reload,
}: BookingContextMenuProps) {
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function closeKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeKey);
    };
  }, [ctxMenu, onClose]);

  if (!ctxMenu) return null;

  function ctxAction(fn: () => void) {
    onClose();
    fn();
  }

  const actor = { id: currentUserId, role: currentUserRole };
  const ctxAllowed = new Set(
    getAllowedBookingActions(actor, {
      status: ctxMenu.item.status,
      requester: ctxMenu.item.requester,
      createdBy: ctxMenu.item.createdBy,
    }, config.kind)
  );

  return (
    <div
      ref={ctxRef}
      className="fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ top: ctxMenu.y, left: ctxMenu.x }}
    >
      <button
        className={menuItemClass}
        onClick={() => ctxAction(() => onViewDetails(ctxMenu.item.id))}
      >
        View details
      </button>

      {ctxAllowed.has("edit") && (
        <button
          className={menuItemClass}
          onClick={() => ctxAction(() => onViewDetails(ctxMenu.item.id))}
        >
          Edit
        </button>
      )}

      {ctxAllowed.has("extend") && (
        <>
          <div className="-mx-1 my-1 h-px bg-muted" />
          <button
            className={menuItemClass}
            onClick={() => ctxAction(() => onExtend(ctxMenu.item.id, 1))}
            disabled={extendingId === ctxMenu.item.id}
          >
            {extendingId === ctxMenu.item.id ? "Extending..." : "Extend +1 day"}
          </button>
          <button
            className={menuItemClass}
            onClick={() => ctxAction(() => onExtend(ctxMenu.item.id, 7))}
            disabled={extendingId === ctxMenu.item.id}
          >
            {extendingId === ctxMenu.item.id ? "Extending..." : "Extend +1 week"}
          </button>
        </>
      )}

      {config.contextMenuExtras.map((extra) =>
        ctxAllowed.has(extra.action) ? (
          <span key={extra.action}>
            <div className="-mx-1 my-1 h-px bg-muted" />
            <button
              className={`${menuItemClass}${extra.danger ? " text-destructive" : ""}`}
              onClick={() => ctxAction(() => {
                if (extra.opensSheet) onViewDetails(ctxMenu.item.id);
                else extra.handler?.(ctxMenu.item.id, items, reload);
              })}
            >
              {extra.label}
            </button>
          </span>
        ) : null
      )}
    </div>
  );
}
