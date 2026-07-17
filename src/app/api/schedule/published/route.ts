import { withAuth } from "@/lib/api";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { ok, parsePagination } from "@/lib/http";
import { listPublishedSchedule } from "@/lib/services/collaborator-schedule";

export const GET = withAuth(async (req, { user }) => {
  requireCollaboratorCapability(user, "PUBLISHED_SCHEDULE_VIEW");
  const { limit: rawLimit, offset } = parsePagination(new URL(req.url).searchParams);
  const limit = Math.min(rawLimit, 100);
  return ok(await listPublishedSchedule({ userId: user.id, limit, offset }));
});
