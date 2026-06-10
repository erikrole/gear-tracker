/**
 * B&H product image URLs surfaced by search live on www.bhphotovideo.com
 * behind Cloudflare bot protection, which 403s hotlinked <img> requests,
 * server-side rehost fetches, and even Brave's thumbnail proxy. The same
 * files are served openly from static.bhphoto.com in square variants
 * (500/1000/1500/2500), so we rewrite to that host for display and rehosting.
 */

const BH_IMAGE_HOSTS = new Set(["bhphotovideo.com", "bhphoto.com", "static.bhphoto.com"]);
const BH_IMAGE_PATH = /\/images\/(images\d+x\d+)\/([^/?#]+\.(?:jpe?g|png|webp|gif))/i;

/** Square variant rehosted as the asset's hero image when a B&H result is saved. */
export const BH_HERO_IMAGE_SIZE = 1000;

/**
 * Rewrite a B&H image URL to its static.bhphoto.com equivalent, optionally at
 * a different square size. Returns null for anything that is not a B&H image
 * URL. Handles Cloudflare-wrapped URLs (/cdn-cgi/image/<options>/https://...)
 * where the real image URL is embedded in the path.
 */
export function toBhStaticImageUrl(url: string, size?: number): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (!BH_IMAGE_HOSTS.has(host)) return null;

  const match = parsed.pathname.match(BH_IMAGE_PATH);
  if (!match) return null;

  const dir = size ? `images${size}x${size}` : match[1];
  return `https://static.bhphoto.com/images/${dir}/${match[2]}`;
}
