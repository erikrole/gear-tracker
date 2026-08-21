import { withHandler } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { renewCompanionSession } from "@/lib/companion-store";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const POST = withHandler(async (req) => {
  await enforceRateLimit(`companion:session:ip:${getClientIp(req)}`, {
    max: 60,
    windowMs: 60_000,
  });
  const companionToken = await renewCompanionSession(req);
  return ok({ companionToken });
});
