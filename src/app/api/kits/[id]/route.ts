import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getKitDetail, updateKit, deleteKit } from "@/lib/services/kits";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "kit", "view");
  const kit = await getKitDetail(params.id);
  return ok({ data: kit });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "kit", "edit");
  const body = updateSchema.parse(await req.json());
  const kit = await updateKit(params.id, body, user.id, user.role);
  return ok({ data: kit });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "kit", "delete");
  await deleteKit(params.id, user.id, user.role);
  return ok({ success: true });
});
