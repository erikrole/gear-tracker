"use client";

import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getInitials, getAvatarColor } from "@/lib/avatar";
import type { ItemThumb, EventSummary } from "../dashboard-types";

export { UserAvatar } from "@/components/UserAvatar";

export function GearAvatarStack({ items, totalCount }: { items: ItemThumb[]; totalCount: number }) {
  if (totalCount === 0) return null;
  const overflow = totalCount - items.length;
  return (
    <AvatarGroup max={99}>
      {items.map((item) => (
        <Avatar key={item.id} size="sm" className="ring-2 ring-background">
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
    </AvatarGroup>
  );
}

const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
};

export function ShiftAvatarStack({ assignedUsers, totalSlots }: { assignedUsers: EventSummary["assignedUsers"]; totalSlots: number }) {
  if (totalSlots === 0) return null;
  const emptySlots = Math.max(0, totalSlots - assignedUsers.length);
  const maxShow = 5;
  const showUsers = assignedUsers.slice(0, maxShow);
  const showEmpty = Math.min(emptySlots, maxShow - showUsers.length);
  const overflow = assignedUsers.length + emptySlots - maxShow;
  return (
    <AvatarGroup max={99}>
      {showUsers.map((u) => {
        const areaLabel = u.area ? AREA_LABELS[u.area] ?? u.area : null;
        const tooltipText = areaLabel ? `${u.name} — ${areaLabel}` : u.name;
        return (
          <Tooltip key={u.id}>
            <TooltipTrigger asChild>
              <Avatar size="sm" className="ring-2 ring-background cursor-default">
                {u.avatarUrl ? (
                  <AvatarImage src={u.avatarUrl} alt={u.name} />
                ) : (
                  <AvatarFallback className={getAvatarColor(u.name)}>{u.initials}</AvatarFallback>
                )}
              </Avatar>
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
    </AvatarGroup>
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
