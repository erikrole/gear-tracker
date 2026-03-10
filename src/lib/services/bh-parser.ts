/**
 * B&H Photo product page parser.
 *
 * Fetches a B&H product URL and extracts metadata from the HTML.
 * Uses multiple selector strategies with fallbacks to handle
 * page structure changes gracefully.
 */

export type BHProductData = {
  name: string | null;
  brand: string | null;
  model: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  /** Diagnostic: why did the fetch/parse fail? */
  warning?: string;
};

const BH_DOMAIN = "bhphotovideo.com";
const FETCH_TIMEOUT_MS = 8000;

/**
 * Validate that a URL is a B&H product page.
 */
export function isValidBHUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(BH_DOMAIN);
  } catch {
    return false;
  }
}

/**
 * Fetch a B&H product page and parse metadata.
 * Returns partial data on parse failure — never throws.
 */
export async function parseBHProduct(url: string): Promise<BHProductData> {
  const empty: BHProductData = {
    name: null,
    brand: null,
    model: null,
    imageUrl: null,
    sourceUrl: url,
  };

  if (!isValidBHUrl(url)) {
    return { ...empty, warning: "Invalid B&H URL" };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { ...empty, warning: `B&H returned HTTP ${res.status} — site may be blocking automated requests` };
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { ...empty, warning: `Could not reach B&H: ${msg}` };
  }

  const result = parseHTML(html, url);

  if (!result.name && !result.brand && !result.model) {
    result.warning = "Page fetched but no product data found — B&H may require browser access";
  }

  return result;
}

/**
 * Extract product metadata from B&H product page HTML.
 *
 * Strategy priority:
 * 1. JSON-LD structured data (most reliable)
 * 2. Open Graph meta tags (fallback)
 * 3. HTML title tag (last resort for name)
 */
export function parseHTML(html: string, sourceUrl: string): BHProductData {
  const result: BHProductData = {
    name: null,
    brand: null,
    model: null,
    imageUrl: null,
    sourceUrl,
  };

  // Strategy 1: JSON-LD structured data
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    result.name = asStr(jsonLd.name);
    const brand = jsonLd.brand;
    result.brand =
      brand && typeof brand === "object" && "name" in brand
        ? asStr((brand as Record<string, unknown>).name)
        : asStr(brand);
    result.model = asStr(jsonLd.mpn) || asStr(jsonLd.model) || asStr(jsonLd.sku);
    result.imageUrl = extractImageFromJsonLd(jsonLd);
  }

  // Strategy 2: Open Graph meta tags (fill gaps)
  if (!result.name) {
    result.name = extractMeta(html, "og:title");
  }
  if (!result.imageUrl) {
    result.imageUrl = extractMeta(html, "og:image");
  }

  // Strategy 3: HTML title (last resort for name)
  if (!result.name) {
    result.name = extractTitle(html);
  }

  // Clean up name: remove " | B&H Photo" suffix
  if (result.name) {
    result.name = result.name.replace(/\s*\|\s*B&H\s*Photo.*$/i, "").trim();
  }

  // Try to extract brand from name if missing
  if (!result.brand && result.name) {
    result.brand = extractBrandFromName(result.name);
  }

  return result;
}

/* ───── Extraction helpers ───── */

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  // Match all JSON-LD script blocks
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      // Look for Product type
      if (data["@type"] === "Product") return data;
      // Check @graph array
      if (Array.isArray(data["@graph"])) {
        const product = data["@graph"].find(
          (item: Record<string, unknown>) => item["@type"] === "Product"
        );
        if (product) return product;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractImageFromJsonLd(jsonLd: Record<string, unknown>): string | null {
  const image = jsonLd.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image) && typeof image[0] === "string") return image[0];
  if (image && typeof image === "object" && "url" in image) {
    return (image as { url: string }).url;
  }
  return null;
}

function extractMeta(html: string, property: string): string | null {
  // Match <meta property="og:title" content="..." /> or <meta name="..." content="..." />
  const escapedProp = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)\\s*=\\s*["']${escapedProp}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1].trim() || null;

  // Also try reversed attribute order: content before property
  const regex2 = new RegExp(
    `<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escapedProp}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1].trim() || null : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() || null : null;
}

/**
 * Heuristic: extract brand as the first word(s) before
 * known product type keywords.
 */
function extractBrandFromName(name: string): string | null {
  // Common camera/lens brand names
  const knownBrands = [
    "Sony", "Canon", "Nikon", "Panasonic", "Fujifilm", "Blackmagic",
    "RED", "ARRI", "Sigma", "Tamron", "Zeiss", "Rode", "Sennheiser",
    "Shure", "DJI", "Manfrotto", "Tilta", "SmallRig", "Atomos",
    "Teradek", "Hollyland", "Godox", "Aputure", "Litepanels",
    "Sound Devices", "Zacuto", "Wooden Camera",
  ];

  for (const brand of knownBrands) {
    if (name.toLowerCase().startsWith(brand.toLowerCase())) {
      return brand;
    }
  }

  return null;
}
