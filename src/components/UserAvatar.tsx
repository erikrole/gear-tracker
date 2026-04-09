"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/avatar";

/**
 * Standardized user avatar with color-coded initials fallback.
 * Pass `name` for auto-derived initials, or override with `initials`.
 */
export function UserAvatar({
  name,
  initials,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  initials?: string;
  avatarUrl?: string | null;
  size?: "sm" | "default";
}) {
  const display = initials ?? getInitials(name);
  return (
    <Avatar size={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={getAvatarColor(name)}>{display}</AvatarFallback>
    </Avatar>
  );
}
