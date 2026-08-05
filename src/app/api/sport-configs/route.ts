import { withAuth } from "@/lib/api";
import { after } from "next/server";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { upsertSportConfigSchema } from "@/lib/validation";
import { getAllSportConfigs, upsertSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { syncCurrentSportCallTimes } from "@/lib/services/schedule-call-time-sync";
import { notifyPublishedScheduleFollowers, notifyPublishedShiftGroupWorkers } from "@/lib/services/notifications";

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "sport_config", "view");
  const configs = await getAllSportConfigs();
  return ok({ data: configs });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "sport_config", "manage");
  await enforceRateLimit(`sport-configs:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = upsertSportConfigSchema.parse(await req.json());
  const config = await upsertSportConfig(
    body.sportCode,
    body.active ?? true,
    body.shiftConfigs ?? [],
    body.shiftStartOffset,
    body.shiftEndOffset,
  );
  const hasCallTimeChange = body.shiftStartOffset !== undefined || body.shiftEndOffset !== undefined;
  let callTimes = null;
  let callTimesFailed = false;
  if (hasCallTimeChange) {
    try {
      callTimes = await syncCurrentSportCallTimes([body.sportCode], { actor: user });
    } catch (error) {
      callTimesFailed = true;
      console.error("Current schedule call-time synchronization failed after sport defaults were saved", error);
    }
  }
  if (callTimes?.publishedChanges.length) {
    after(() => Promise.allSettled(callTimes!.publishedChanges.flatMap((change) => [
      notifyPublishedShiftGroupWorkers(change.shiftGroupId, change.affectedUserIds),
      notifyPublishedScheduleFollowers(change.shiftGroupId),
    ])).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Published schedule call-time notification failed", result.reason);
        }
      }
    }));
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "sport_config",
    entityId: config!.id,
    action: "sport_config_upserted",
    after: {
      sportCode: body.sportCode,
      active: body.active,
      shiftConfigs: body.shiftConfigs,
      callTimes,
      callTimesFailed,
    },
  });

  return ok({ data: config, callTimes, callTimesFailed }, 201);
});
