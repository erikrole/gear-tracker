import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getSignatureMemberCaptureBootstrap } from "@/lib/services/signatures";

export const GET = withAuth<{ id: string; memberId: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "signature", "capture");
  return ok(await getSignatureMemberCaptureBootstrap(params.id, params.memberId));
});
