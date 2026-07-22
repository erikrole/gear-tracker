import { withAuth } from "@/lib/api";
import { z } from "zod";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import {
  createPublishedShiftGroupNotifications,
  notifyPublishedShiftGroupWorkers,
  notifyPublishedScheduleFollowers,
} from "@/lib/services/notifications";
import { publishShiftGroup } from "@/lib/services/schedule-publication";

const publishSchema = z.object({
  expectedWorkingVersion: z.number().int().min(1).optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`shift:publish:${user.id}`, { max: 30, windowMs: 60_000 });
  const rawBody = await req.text();
  let parsedBody: unknown = {};
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
  }
  const body = publishSchema.parse(parsedBody);

  const result = await publishShiftGroup(params.id, user.id, body.expectedWorkingVersion, user.role);

  if (!result.before.publishedAt) {
    createPublishedShiftGroupNotifications(params.id).catch(() => {});
  } else if (result.publishedSnapshotChanged) {
    await notifyPublishedShiftGroupWorkers(params.id, result.affectedUserIds).catch((error) => {
      console.error("[schedule-publish] worker notifications failed", error);
    });
    await notifyPublishedScheduleFollowers(params.id).catch((error) => {
      console.error("[schedule-publish] follower notifications failed", error);
    });
  }

  return ok({ data: result.after });
});
