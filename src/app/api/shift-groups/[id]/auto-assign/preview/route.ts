import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getAutoFillPreview } from "@/lib/services/auto-fill-preview";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");

  const preview = await getAutoFillPreview(params.id);

  return ok({ data: preview });
});
