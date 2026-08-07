import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  getNonGameScheduleDefaults,
  NON_GAME_SCHEDULE_DEFAULTS_KEY,
  nonGameScheduleDefaultsSchema,
} from "@/lib/services/non-game-schedule-defaults";
import { generateShiftsForEvents } from "@/lib/services/shift-generation";

export const GET = withAuth(async (_req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  return ok({ data: await getNonGameScheduleDefaults() });
});

export const PUT = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
  await enforceRateLimit(`non-game-schedule:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const after = nonGameScheduleDefaultsSchema.parse(await req.json());
  const before = await getNonGameScheduleDefaults();

  await db.systemConfig.upsert({
    where: { key: NON_GAME_SCHEDULE_DEFAULTS_KEY },
    create: { key: NON_GAME_SCHEDULE_DEFAULTS_KEY, value: after },
    update: { value: after },
  });
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "system_config",
    entityId: NON_GAME_SCHEDULE_DEFAULTS_KEY,
    action: "non_game_schedule_defaults_updated",
    before,
    after,
  });

  const generation = await generateShiftsForEvents({
    where: {
      opponent: null,
      shiftGroup: null,
      startsAt: { gte: new Date() },
      status: { not: "CANCELLED" },
      isHidden: false,
      archivedAt: null,
    },
  });
  return ok({ data: after, generation });
});
