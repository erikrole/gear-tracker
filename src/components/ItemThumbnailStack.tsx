"use client";

import { cn } from "@/lib/utils";
import { AssetImage } from "@/components/AssetImage";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";

export type ItemThumbnailStackItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  fallback?: string | null;
};

export function ItemThumbnailStack({
  items,
  totalCount,
  max = 3,
  className,
  surfaceClassName = "border-background bg-muted",
}: {
  items: ItemThumbnailStackItem[];
  totalCount: number;
  max?: number;
  className?: string;
  surfaceClassName?: string;
}) {
  if (totalCount === 0) return null;

  const visibleItems = items.slice(0, max);
  const overflow = totalCount - visibleItems.length;

  return (
    <AvatarGroup
      className={cn("items-center", className)}
      aria-label={`${totalCount} gear ${totalCount === 1 ? "item" : "items"}`}
    >
      {visibleItems.map((item) => {
        const fallbackChar = (item.fallback ?? item.name[0] ?? "?").toUpperCase();
        return (
          <AssetImage
            key={item.id}
            src={item.imageUrl}
            alt={item.name}
            size={24}
            className={cn("rounded-full border-2", surfaceClassName)}
            fallbackClassName={cn("rounded-full text-[9px] font-semibold", surfaceClassName)}
            fallback={fallbackChar}
          />
        );
      })}
      {overflow > 0 && (
        <AvatarGroupCount
          size="sm"
          className={cn("border-2 text-[10px]", surfaceClassName)}
          aria-label={`${overflow} more gear ${overflow === 1 ? "item" : "items"}`}
        >
          +{overflow > 99 ? "99" : overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}
