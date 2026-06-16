import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "checkout", "complete");
  void params.id;
  throw new HttpError(403, "Pick up gear at a kiosk. App/web cannot complete checkout custody.");
});
