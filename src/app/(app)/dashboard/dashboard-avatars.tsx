"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/ui/avatar-group";
import type { ItemThumb, EventSummary } from "../dashboard-types";

export function UserAvatar({ initials, avatarUrl, size = "sm" }: { initials: string; avatarUrl?: string | null; size?: "sm" | "default" }) {
  return (
    <Avatar size={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

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

export function ShiftAvatarStack({ assignedUsers, totalSlots }: { assignedUsers: EventSummary["assignedUsers"]; totalSlots: number }) {
  if (totalSlots === 0) return null;
  const emptySlots = Math.max(0, totalSlots - assignedUsers.length);
  const maxShow = 5;
  const showUsers = assignedUsers.slice(0, maxShow);
  const showEmpty = Math.min(emptySlots, maxShow - showUsers.length);
  const overflow = assignedUsers.length + emptySlots - maxShow;
  return (
    <AvatarGroup max={99}>
      {showUsers.map((u) => (
        <Avatar key={u.id} size="sm" className="ring-2 ring-background" title={u.name}>
          {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : <AvatarFallback>{u.initials}</AvatarFallback>}
        </Avatar>
      ))}
      {Array.from({ length: showEmpty }).map((_, i) => (
        <Avatar key={`empty-${i}`} size="sm" className="ring-2 ring-background">
          <AvatarFallback className="border border-dashed border-muted-foreground/30 bg-transparent" />
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
