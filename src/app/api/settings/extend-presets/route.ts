import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { db } from "@/lib/db";

const CONFIG_KEY = "extend_presets";

export type ExtendPreset = {
  label: string;
  /** Duration in minutes */
  minutes: number;
};

const DEFAULT_PRESETS: ExtendPreset[] = [
  { label: "+1 day", minutes: 24 * 60 },
  { label: "+3 days", minutes: 3 * 24 * 60 },
  { label: "+1 week", minutes: 7 * 24 * 60 },
];

const presetSchema = z.object({
  label: z.string().min(1).max(50),
  minutes: z.number().int().min(1).max(525600), // max 1 year
});

const putSchema = z.object({
  presets: z.array(presetSchema).min(1).max(10),
});

/**
 * GET /api/settings/extend-presets
 * Returns the configured extend presets. Any authenticated user can read.
 */
export const GET = withAuth(async () => {
  const config = await db.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  const presets = (config?.value as ExtendPreset[] | null) ?? DEFAULT_PRESETS;
  return ok({ data: { presets } });
});

/**
 * PUT /api/settings/extend-presets
 * Updates extend presets. Admin only.
 */
export const PUT = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");

  const body = putSchema.parse(await req.json());

  const jsonValue = JSON.parse(JSON.stringify(body.presets));
  await db.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: jsonValue },
    update: { value: jsonValue },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "system_config",
    entityId: CONFIG_KEY,
    action: "extend_presets_updated",
    after: { presets: body.presets },
  });

  return ok({ data: { presets: body.presets } });
});
