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
      className="ctx-menu"
      style={{ top: ctxMenu.y, left: ctxMenu.x }}
    >
      <button
        className="ctx-menu-item"
        onClick={() => ctxAction(() => onViewDetails(ctxMenu.item.id))}
      >
        View details
      </button>

      {ctxAllowed.has("edit") && (
        <button
          className="ctx-menu-item"
          onClick={() => ctxAction(() => onViewDetails(ctxMenu.item.id))}
        >
          Edit
        </button>
      )}

      {ctxAllowed.has("extend") && (
        <>
          <div className="ctx-menu-sep" />
          <button
            className="ctx-menu-item"
            onClick={() => ctxAction(() => onExtend(ctxMenu.item.id, 1))}
            disabled={extendingId === ctxMenu.item.id}
          >
            {extendingId === ctxMenu.item.id ? "Extending..." : "Extend +1 day"}
          </button>
          <button
            className="ctx-menu-item"
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
            <div className="ctx-menu-sep" />
            <button
              className={`ctx-menu-item${extra.danger ? " danger" : ""}`}
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
