import { withAuth } from "@/lib/api";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { ok } from "@/lib/http";
import { getPublishedScheduleEvent } from "@/lib/services/collaborator-schedule";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requireCollaboratorCapability(user, "PUBLISHED_SCHEDULE_VIEW");
  return ok({ data: await getPublishedScheduleEvent(params.id, user.id) });
});
