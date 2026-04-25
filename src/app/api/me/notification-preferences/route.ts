import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadUserPrefs,
  saveUserPrefs,
} from "@/lib/services/notification-prefs";

const putSchema = z.object({
  pausedUntil: z.string().datetime({ offset: true }).nullable(),
  channels: z.object({
    email: z.boolean(),
    push: z.boolean(),
  }),
});

/** GET /api/me/notification-preferences — returns the caller's prefs (or defaults). */
export const GET = withAuth(async (_req, { user }) => {
  const prefs = await loadUserPrefs(user.id);
  return ok({ data: prefs, defaults: DEFAULT_NOTIFICATION_PREFS });
});

/** PUT /api/me/notification-preferences — full-replace; the body must include all fields. */
export const PUT = withAuth(async (req, { user }) => {
  await enforceRateLimit(`notif-prefs:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const body = putSchema.parse(await req.json());
  await saveUserPrefs(user.id, body);
  return ok({ data: body });
});
