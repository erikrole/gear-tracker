import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import {
  registerCompanionDevice,
  requireCompanion,
  revokeCompanionSession,
} from "@/lib/companion-store";
import { apnsTokenSchema } from "@/lib/validation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

const deviceSchema = z.object({ token: apnsTokenSchema }).strict();

export const POST = withHandler(async (req) => {
  await enforceRateLimit(`companion:devices:ip:${getClientIp(req)}`, {
    max: 60,
    windowMs: 60_000,
  });
  const companion = await requireCompanion(req);
  const body = deviceSchema.parse(await req.json());
  await registerCompanionDevice(companion, body.token.toLowerCase());
  return ok({ success: true });
});

export const DELETE = withHandler(async (req) => {
  await enforceRateLimit(`companion:devices:ip:${getClientIp(req)}`, {
    max: 60,
    windowMs: 60_000,
  });
  await revokeCompanionSession(req);
  return ok({ success: true });
});
