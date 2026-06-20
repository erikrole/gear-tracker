"use client";

import { Avatar, AvatarFallback, AvatarImage, type AvatarSize } from "@/components/ui/avatar";
import { avatarColorClass, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type UserAvatarSize = AvatarSize;

export function UserAvatar({
  name,
  initials,
  avatarUrl,
  size = "sm",
  className,
  fallbackClassName,
  noColor = false,
}: {
  name: string;
  initials?: string;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  className?: string;
  /** Override fallback bg/text classes — wins via tailwind-merge. */
  fallbackClassName?: string;
  /** Disable the deterministic color hash and use the muted default. */
  noColor?: boolean;
}) {
  const display = initials ?? getInitials(name);
  const colorClass = noColor ? "bg-muted text-muted-foreground" : avatarColorClass(name);

  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className="object-cover" />}
      <AvatarFallback
        className={cn(
          "font-semibold uppercase shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]",
          colorClass,
          fallbackClassName,
        )}
      >
        {display}
      </AvatarFallback>
    </Avatar>
  );
}
