import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "checkout", "scan");
  void params.id;
  throw new HttpError(403, "Custody scan sessions must be started at a kiosk.");
});
