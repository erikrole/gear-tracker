"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeAssetImageSrc } from "@/lib/asset-image";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type AssetImageProps = {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
  fallback?: React.ReactNode;
};

export function AssetImage({
  src,
  alt,
  size = 36,
  className,
  fallbackClassName,
  fallback,
}: AssetImageProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = normalizeAssetImageSrc(src);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  return (
    <Avatar
      className={cn(
        "shrink-0 rounded-md bg-muted outline outline-1 outline-black/10 dark:outline-white/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {normalizedSrc && !failed ? (
        <AvatarImage
          src={normalizedSrc}
          alt={alt}
          className="rounded-md object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn("rounded-md bg-muted text-muted-foreground", fallbackClassName)}
        aria-label={alt}
      >
        {fallback ?? <Package className="size-4" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}
