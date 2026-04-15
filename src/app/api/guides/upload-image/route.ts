import { withAuth } from "@/lib/api";
import { requirePermission } from "@/lib/rbac";
import { put } from "@vercel/blob";
import { ok, HttpError } from "@/lib/http";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "guide", "edit");

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

  const blob = await put(`guides/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return ok({ url: blob.url });
});
