import { withAuth } from "@/lib/api";
import { after } from "next/server";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { sportCodeSchema, updateSportConfigSchema } from "@/lib/validation";
import { getSportConfig, upsertSportConfig, toggleSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { syncCurrentSportCallTimes } from "@/lib/services/schedule-call-time-sync";
import { notifyPublishedScheduleFollowers, notifyPublishedShiftGroupWorkers } from "@/lib/services/notifications";

export const GET = withAuth<{ sportCode: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "sport_config", "view");
  const sportCode = sportCodeSchema.parse(params.sportCode);
  const config = await getSportConfig(sportCode);
  if (!config) throw new HttpError(404, "Sport config not found");
  return ok({ data: config });
});

export const PATCH = withAuth<{ sportCode: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "sport_config", "manage");
  await enforceRateLimit(`sport-configs:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const sportCode = sportCodeSchema.parse(params.sportCode);

  const body = updateSportConfigSchema.parse(await req.json());
  const existing = await getSportConfig(sportCode);
  if (!existing) throw new HttpError(404, "Sport config not found");

  let config;
  const hasCallTimeChange = body.shiftStartOffset !== undefined || body.shiftEndOffset !== undefined;
  if (body.shiftConfigs || hasCallTimeChange) {
    config = await upsertSportConfig(
      sportCode,
      body.active ?? existing.active,
      body.shiftConfigs ?? existing.shiftConfigs.map((sc) => ({
        area: sc.area,
        homeCount: sc.homeCount,
        awayCount: sc.awayCount,
        homeStaffCount: sc.homeStaffCount,
        homeStudentCount: sc.homeStudentCount,
        awayStaffCount: sc.awayStaffCount,
        awayStudentCount: sc.awayStudentCount,
      })),
      body.shiftStartOffset,
      body.shiftEndOffset,
    );
  } else if (body.active !== undefined) {
    config = await toggleSportConfig(sportCode, body.active);
  } else {
    config = existing;
  }

  let callTimes = null;
  let callTimesFailed = false;
  if (hasCallTimeChange) {
    try {
      callTimes = await syncCurrentSportCallTimes([sportCode], { actor: user });
    } catch (error) {
      callTimesFailed = true;
      console.error("Current schedule call-time synchronization failed after sport defaults were saved", error);
    }
  }
  if (callTimes?.publishedChanges.length) {
    after(() => Promise.allSettled(callTimes.publishedChanges.flatMap((change) => [
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
    entityId: existing.id,
    action: "sport_config_updated",
    before: { active: existing.active },
    after: { active: config!.active, ...body, callTimes, callTimesFailed },
  });

  return ok({ data: config, callTimes, callTimesFailed });
});
