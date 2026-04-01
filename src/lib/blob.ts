import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5 MB (Vercel serverless body limit)

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "File must be JPEG, PNG, WebP, or GIF";
  }
  if (file.size > MAX_SIZE) {
    return "File must be under 4.5 MB";
  }
  return null;
}

export function isBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com");
}

export async function uploadImage(
  file: File,
  assetId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `assets/${assetId}/${Date.now()}.${ext}`;

  const blob = await put(pathname, file.stream(), {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

export async function uploadBookingPhoto(
  file: File,
  bookingId: string,
  phase: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `bookings/${bookingId}/${phase.toLowerCase()}/${Date.now()}.${ext}`;

  const blob = await put(pathname, file.stream(), {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

/**
 * Download an external image and re-host it on Vercel Blob.
 * Returns the blob URL, or null if download fails.
 */
export async function downloadImageToBlob(
  url: string,
  assetId: string,
  timeoutMs = 8000
): Promise<string | null> {
  // Already hosted — nothing to do
  if (isBlobUrl(url)) return url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? extFromUrl(url);
    if (!ext) return null; // unrecognised image type

    const body = await res.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_SIZE) return null;

    const pathname = `assets/${assetId}/${Date.now()}.${ext}`;
    const blob = await put(pathname, Buffer.from(body), {
      access: "public",
      contentType: contentType || `image/${ext === "jpg" ? "jpeg" : ext}`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url;
  } catch {
    return null;
  }
}

function extFromUrl(url: string): string | null {
  const match = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  if (!match) return null;
  return match[1].toLowerCase().replace("jpeg", "jpg");
}

export async function deleteImage(url: string): Promise<void> {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
