export function normalizeAssetImageSrc(src: string | null | undefined): string | null {
  const trimmed = src?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }

  return trimmed;
}

/**
 * True when the src is our blob-hosted copy, which the next/image optimizer
 * accepts (next.config.ts remotePatterns). Legacy external item-image URLs
 * must render unoptimized — /_next/image rejects hosts outside the allowlist.
 * Client-safe: keep this here rather than in @/lib/blob, which pulls
 * server-only dependencies into the bundle.
 */
export function isOptimizableAssetImageSrc(src: string): boolean {
  try {
    return new URL(src).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
