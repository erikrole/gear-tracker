"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";

export function UserAvatar({
  name,
  initials,
  avatarUrl,
  size = "sm",
  className,
}: {
  name: string;
  initials?: string;
  avatarUrl?: string | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const display = initials ?? getInitials(name);
  return (
    <Avatar size={size} className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback>{display}</AvatarFallback>
    </Avatar>
  );
}
