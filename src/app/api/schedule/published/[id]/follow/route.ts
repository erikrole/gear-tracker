import { z } from "zod";
import { withAuth } from "@/lib/api";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { ok } from "@/lib/http";
import { setPublishedScheduleFollow } from "@/lib/services/collaborator-schedule";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const followSchema = z.object({ following: z.boolean() }).strict();

export const PUT = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireCollaboratorCapability(user, "SCHEDULE_FOLLOW");
  await enforceRateLimit(`published-schedule-follow:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = followSchema.parse(await req.json());
  const data = await setPublishedScheduleFollow({
    eventId: params.id,
    userId: user.id,
    actorRole: user.role,
    following: body.following,
  });
  return ok({ data });
});
