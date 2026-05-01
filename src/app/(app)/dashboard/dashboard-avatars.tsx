"use client";

import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/UserAvatar";
import type { ItemThumb, EventSummary } from "../dashboard-types";

export function GearAvatarStack({ items, totalCount }: { items: ItemThumb[]; totalCount: number }) {
  if (totalCount === 0) return null;
  const overflow = totalCount - items.length;
  return (
    <div className="flex -space-x-2">
      {items.map((item) => (
        <Avatar key={item.id} size="sm" className="ring-2 ring-background bg-muted">
          {item.imageUrl ? (
            <AvatarImage src={item.imageUrl} alt={item.name || "Item"} />
          ) : (
            <AvatarFallback className="text-[10px]">{(item.name || "?")[0].toUpperCase()}</AvatarFallback>
          )}
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar size="sm" className="ring-2 ring-background">
          <AvatarFallback className="text-[10px] bg-muted">+{overflow}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export function ShiftAvatarStack({ assignedUsers, totalSlots, filledSlots }: { assignedUsers: EventSummary["assignedUsers"]; totalSlots: number; filledSlots: number }) {
  if (totalSlots === 0) return null;
  const emptySlots = Math.max(0, totalSlots - filledSlots);
  const maxShow = 5;
  const showUsers = assignedUsers.slice(0, maxShow);
  const showEmpty = Math.min(emptySlots, maxShow - showUsers.length);
  const overflow = assignedUsers.length + emptySlots - maxShow;
  return (
    <div className="flex -space-x-2">
      {showUsers.map((u) => {
        const areaLabel = u.area ? AREA_LABELS[u.area] ?? u.area : null;
        const tooltipText = areaLabel ? `${u.name} — ${areaLabel}` : u.name;
        return (
          <Tooltip key={u.id}>
            <TooltipTrigger asChild>
              <span className="cursor-default">
                <UserAvatar
                  name={u.name}
                  avatarUrl={u.avatarUrl}
                  size="sm"
                  className="ring-2 ring-background"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{tooltipText}</TooltipContent>
          </Tooltip>
        );
      })}
      {Array.from({ length: showEmpty }).map((_, i) => (
        <EmptySlotAvatar key={`empty-${i}`} />
      ))}
      {overflow > 0 && (
        <Avatar size="sm" className="ring-2 ring-background">
          <AvatarFallback className="text-[10px] bg-muted">+{overflow}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

/** Standardized empty shift slot placeholder */
export function EmptySlotAvatar({ size = "sm" }: { size?: "sm" | "default" }) {
  return (
    <Avatar size={size} className="ring-2 ring-background">
      <AvatarFallback className="border-2 border-dashed border-muted-foreground/30 bg-transparent">
        <UserIcon className="size-3 text-muted-foreground/40" />
      </AvatarFallback>
    </Avatar>
  );
}
