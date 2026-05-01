"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColorClass, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type UserAvatarSize = "xs" | "sm" | "default" | "md" | "lg" | "xl";

const SIZE_MAP: Record<UserAvatarSize, { wrapper: string; text: string }> = {
  xs: { wrapper: "size-5", text: "text-[9px]" },
  sm: { wrapper: "size-6", text: "text-[10px]" },
  default: { wrapper: "size-7", text: "text-xs" },
  md: { wrapper: "size-9", text: "text-[13px]" },
  lg: { wrapper: "size-11", text: "text-sm" },
  xl: { wrapper: "size-20", text: "text-2xl" },
};

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
  const sizing = SIZE_MAP[size];
  const display = initials ?? getInitials(name);
  const colorClass = noColor ? "bg-muted text-muted-foreground" : avatarColorClass(name);

  return (
    <Avatar className={cn(sizing.wrapper, className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback
        className={cn("font-medium", sizing.text, colorClass, fallbackClassName)}
      >
        {display}
      </AvatarFallback>
    </Avatar>
  );
}
