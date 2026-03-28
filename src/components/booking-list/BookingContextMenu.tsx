"use client";

import { getAllowedBookingActions } from "@/lib/booking-actions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookingItem, BookingListConfig } from "./types";

export type BookingMenuProps = {
  item: BookingItem;
  currentUserId: string;
  currentUserRole: string;
  config: BookingListConfig;
  extendingId: string | null;
  onViewDetails: (id: string) => void;
  onExtend: (bookingId: string, days: number) => void;
  items: BookingItem[];
  reload: () => Promise<void>;
  setItems: (updater: (items: BookingItem[]) => BookingItem[]) => void;
};

/** Shared menu items used by both ContextMenu and DropdownMenu */
function MenuItems({
  item,
  currentUserId,
  currentUserRole,
  config,
  extendingId,
  onViewDetails,
  onExtend,
  items,
  reload,
  setItems,
  Separator,
  Item,
}: BookingMenuProps & {
  Separator: React.ComponentType;
  Item: React.ComponentType<{ children?: React.ReactNode; className?: string; onSelect?: () => void; disabled?: boolean }>;
}) {
  const actor = { id: currentUserId, role: currentUserRole };
  const allowed = new Set(
    getAllowedBookingActions(actor, {
      status: item.status,
      requester: item.requester,
      createdBy: item.createdBy,
    }, config.kind)
  );

  return (
    <>
      <Item onSelect={() => onViewDetails(item.id)}>View details</Item>

      {allowed.has("edit") && (
        <Item onSelect={() => onViewDetails(item.id)}>Edit</Item>
      )}

      {allowed.has("extend") && (
        <>
          <Separator />
          <Item
            onSelect={() => onExtend(item.id, 1)}
            disabled={extendingId === item.id}
          >
            {extendingId === item.id ? "Extending..." : "Extend +1 day"}
          </Item>
          <Item
            onSelect={() => onExtend(item.id, 7)}
            disabled={extendingId === item.id}
          >
            {extendingId === item.id ? "Extending..." : "Extend +1 week"}
          </Item>
        </>
      )}

      {config.contextMenuExtras.map((extra) =>
        allowed.has(extra.action) ? (
          <span key={extra.action}>
            <Separator />
            <Item
              className={extra.danger ? "text-destructive focus:text-destructive" : undefined}
              onSelect={() => {
                if (extra.opensSheet) onViewDetails(item.id);
                else extra.handler?.(item.id, items, reload, setItems);
              }}
            >
              {extra.label}
            </Item>
          </span>
        ) : null
      )}
    </>
  );
}

/** ContextMenu wrapper — wraps children with right-click trigger */
export function BookingContextMenuWrapper({
  children,
  ...menuProps
}: BookingMenuProps & { children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItems {...menuProps} Separator={ContextMenuSeparator} Item={ContextMenuItem} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** DropdownMenu for overflow button (mobile + desktop "..." button) */
export function BookingOverflowMenu({
  children,
  ...menuProps
}: BookingMenuProps & { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MenuItems {...menuProps} Separator={DropdownMenuSeparator} Item={DropdownMenuItem} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
