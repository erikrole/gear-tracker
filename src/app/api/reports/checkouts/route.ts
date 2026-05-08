import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getCheckoutReport } from "@/lib/services/reports";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "report", "view");
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10);
  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    throw new HttpError(400, `days must be between 1 and ${MAX_DAYS}`);
  }
  return ok(await getCheckoutReport(days));
});
