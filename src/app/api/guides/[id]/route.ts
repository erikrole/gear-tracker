import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getGuide, getGuideBySlug, updateGuide, deleteGuide } from "@/lib/guides";
import { updateGuideSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { Role } from "@prisma/client";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "guide", "view");

  // Accept both IDs (cuid) and slugs — try ID first, fall back to slug
  let guide;
  try {
    guide = await getGuide(params.id);
  } catch {
    guide = await getGuideBySlug(params.id);
  }

  // Students cannot access unpublished guides
  if (user.role === Role.STUDENT && !guide.published) {
    throw new HttpError(404, "Guide not found");
  }

  return ok({ data: guide });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "guide", "edit");

  const body = updateGuideSchema.parse(await req.json());
  const before = await getGuide(params.id);
  const updated = await updateGuide(params.id, body, user.role, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "guide",
    entityId: params.id,
    action: "guide_updated",
    before: { title: before.title, category: before.category, published: before.published },
    after: { title: updated.title, category: updated.category, published: updated.published },
  });

  return ok({ data: updated });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "guide", "delete");

  const guide = await getGuide(params.id);
  await deleteGuide(params.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "guide",
    entityId: params.id,
    action: "guide_deleted",
    before: { title: guide.title, category: guide.category },
  });

  return ok({ data: { deleted: true } });
});
