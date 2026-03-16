import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5 MB (Vercel serverless body limit)

export function validateImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "File must be JPEG, PNG, WebP, or GIF";
  }
  if (file.size > MAX_SIZE) {
    return "File must be under 4.5 MB";
  }
  return null;
}

export async function uploadImage(
  file: File,
  assetId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const pathname = `assets/${assetId}/${Date.now()}.${ext}`;

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

export async function deleteImage(url: string): Promise<void> {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
