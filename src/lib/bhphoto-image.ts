/**
 * B&H image URLs surfaced by search live on www.bhphotovideo.com and
 * static.bhphotovideo.com behind Cloudflare bot protection, which 403s
 * hotlinked <img> requests, server-side rehost fetches, and even Brave's
 * thumbnail proxy. Product photos (but not Explora blog images) are also
 * served openly from static.bhphoto.com in square variants
 * (500/1000/1500/2500), so we rewrite to that host for display and
 * rehosting, and drop B&H results that have no open equivalent.
 */

const BH_IMAGE_PATH =
  /\/images\/((?:multiple_images\/)?)(images\d+x\d+)\/([^/?#]+\.(?:jpe?g|png|webp|gif))/i;

/** Square variant rehosted as the asset's hero image when a B&H result is saved. */
export const BH_HERO_IMAGE_SIZE = 1000;

function parseHttpUrl(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return parsed;
}

function isBhHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "bhphotovideo.com" ||
    host.endsWith(".bhphotovideo.com") ||
    host === "bhphoto.com" ||
    host.endsWith(".bhphoto.com")
  );
}

/**
 * Rewrite a B&H product image URL to its static.bhphoto.com equivalent,
 * optionally at a different square size. Returns null for anything that is
 * not a B&H product image URL. Handles Cloudflare-wrapped URLs
 * (/cdn-cgi/image/<options>/https://...) where the real image URL is embedded
 * in the path, and the multiple_images/ gallery variant.
 */
export function toBhStaticImageUrl(url: string, size?: number): string | null {
  const parsed = parseHttpUrl(url);
  if (!parsed || !isBhHost(parsed.hostname)) return null;

  const match = parsed.pathname.match(BH_IMAGE_PATH);
  if (!match) return null;

  const dir = size ? `images${size}x${size}` : match[2];
  return `https://static.bhphoto.com/images/${match[1]}${dir}/${match[3]}`;
}

/**
 * True for B&H-family image URLs that have no open static equivalent (e.g.
 * Explora blog images on static.bhphotovideo.com). These 403 for browsers,
 * server fetches, and Brave's thumbnail proxy alike, so they can never be
 * displayed or rehosted.
 */
export function isBlockedBhImageUrl(url: string): boolean {
  const parsed = parseHttpUrl(url);
  if (!parsed || !isBhHost(parsed.hostname)) return false;
  return toBhStaticImageUrl(url) === null;
}
