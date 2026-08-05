import { withAuth } from "@/lib/api";
import { after } from "next/server";
import { z } from "zod";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import {
  createPublishedShiftGroupNotifications,
  notifyPublishedShiftGroupWorkers,
  notifyPublishedScheduleFollowers,
} from "@/lib/services/notifications";
import { getPublishPreflight, publishShiftGroup } from "@/lib/services/schedule-publication";

const publishSchema = z.object({
  expectedWorkingVersion: z.number().int().min(1).optional(),
});

/**
 * What would block this publish, without attempting it. Read on opening the
 * publish review so staff see the whole list before committing, rather than
 * discovering it one rejected attempt at a time.
 */
export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  return ok({ data: await getPublishPreflight(params.id) });
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
    after(() => createPublishedShiftGroupNotifications(params.id).catch((error) => {
      console.error("[schedule-publish] initial worker notifications failed", error);
    }));
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
