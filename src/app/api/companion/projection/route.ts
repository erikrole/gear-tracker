import { withHandler } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { readCompanionProjection, requireCompanion } from "@/lib/companion-store";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  projectionForRole,
  type CompanionProjection,
} from "@/lib/services/companion-projection";

export const GET = withHandler(async (req) => {
  await enforceRateLimit(`companion:projection:ip:${getClientIp(req)}`, {
    max: 240,
    windowMs: 60_000,
  });
  const companion = await requireCompanion(req);
  const projection = await readCompanionProjection<CompanionProjection>();
  if (!projection) {
    throw new HttpError(503, "No companion projection is available yet. Showing cached data.");
  }
  return ok({ data: projectionForRole(projection, companion.role) });
});
