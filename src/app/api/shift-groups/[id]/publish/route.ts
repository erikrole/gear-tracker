import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createPublishedShiftGroupNotifications } from "@/lib/services/notifications";
import { publishShiftGroup } from "@/lib/services/schedule-publication";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");

  const result = await publishShiftGroup(params.id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_group",
    entityId: params.id,
    action: result.before.publishedAt ? "shift_group_republished" : "shift_group_published",
    before: result.before,
    after: result.after,
  });

  if (!result.before.publishedAt) {
    createPublishedShiftGroupNotifications(params.id).catch(() => {});
  }

  return ok({ data: result.after });
});
