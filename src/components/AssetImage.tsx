"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

type AssetImageProps = {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  /** Extra classes on the fallback placeholder */
  fallbackClassName?: string;
};

/**
 * Asset thumbnail with automatic error fallback.
 * Shows a placeholder icon when the image fails to load or src is null.
 */
export function AssetImage({
  src,
  alt,
  size = 36,
  className,
  fallbackClassName,
}: AssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "rounded-md bg-muted flex items-center justify-center shrink-0",
          fallbackClassName,
          className
        )}
        style={{ width: size, height: size }}
      >
        <Package className="size-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size * 2}
      height={size * 2}
      className={cn("rounded-md object-cover shrink-0", className)}
      style={{ width: size, height: size }}
      unoptimized={!src.includes(".public.blob.vercel-storage.com")}
      onError={() => setFailed(true)}
    />
  );
}
