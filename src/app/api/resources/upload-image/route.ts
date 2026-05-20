import { withAuth } from "@/lib/api";
import { requirePermission } from "@/lib/rbac";
import { put } from "@vercel/blob";
import { ok, HttpError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const UPLOAD_LIMIT = { max: 30, windowMs: 5 * 60_000 };

function sanitizeFileName(name: string) {
  const leaf = name.split(/[\\/]/).pop() || "image";
  const sanitized = leaf.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
  return sanitized || "image";
}

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "resource", "edit");

  const { allowed } = await checkRateLimit(`resource:upload:${user.id}`, UPLOAD_LIMIT);
  if (!allowed) {
    throw new HttpError(429, "Too many uploads. Please wait a moment.");
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new HttpError(400, "No file provided");
  }

  if (!file.type.startsWith("image/")) {
    throw new HttpError(400, "Only image files are allowed");
  }

  // 10MB limit per image
  if (file.size > 10 * 1024 * 1024) {
    throw new HttpError(413, "Image too large (max 10MB)");
  }

  const blob = await put(`resources/${Date.now()}-${sanitizeFileName(file.name)}`, file, {
    access: "public",
  });

  return ok({ url: blob.url });
});
