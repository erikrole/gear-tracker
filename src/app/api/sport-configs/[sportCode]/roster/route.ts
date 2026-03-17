import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { sportRosterSchema, sportRosterBulkSchema } from "@/lib/validation";
import {
  getSportRoster,
  addToRoster,
  removeFromRoster,
  bulkAddToRoster,
} from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ sportCode: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "student_sport", "view");
  const { sportCode } = params;
  const roster = await getSportRoster(sportCode);
  return ok({ data: roster });
});

export const POST = withAuth<{ sportCode: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "student_sport", "manage");
  const { sportCode } = params;
  const body = await req.json();

  // Support both single and bulk add
  if (body.userIds) {
    const parsed = sportRosterBulkSchema.parse({ ...body, sportCode });
    const roster = await bulkAddToRoster(parsed.userIds, sportCode);

    await createAuditEntry({
      actorId: user.id,
      actorRole: user.role,
      entityType: "student_sport_assignment",
      entityId: sportCode,
      action: "roster_bulk_added",
      after: { sportCode, userIds: parsed.userIds },
    });

    return ok({ data: roster }, 201);
  }

  const parsed = sportRosterSchema.parse({ ...body, sportCode });
  const assignment = await addToRoster(parsed.userId, sportCode);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_sport_assignment",
    entityId: assignment.id,
    action: "roster_added",
    after: { sportCode, userId: parsed.userId },
  });

  return ok({ data: assignment }, 201);
});

export const DELETE = withAuth<{ sportCode: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "student_sport", "manage");
  const { sportCode } = params;
  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignmentId");

  if (!assignmentId) {
    throw new HttpError(400, "assignmentId query parameter required");
  }

  await removeFromRoster(assignmentId);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "student_sport_assignment",
    entityId: assignmentId,
    action: "roster_removed",
    after: { sportCode, assignmentId },
  });

  return ok({ success: true });
});
