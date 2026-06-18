import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import {
  applyCopyForwardCrew,
  getScheduleTemplateReview,
} from "@/lib/services/schedule-template-review";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");

  const review = await getScheduleTemplateReview(params.id);

  return ok({ data: review });
});

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");

  const result = await applyCopyForwardCrew(params.id, {
    id: user.id,
    role: user.role,
  });

  return ok({ data: result });
});
