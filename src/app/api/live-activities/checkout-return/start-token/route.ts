import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import {
  registerCheckoutReturnLiveActivityStartToken,
  revokeCheckoutReturnLiveActivityStartTokens,
} from "@/lib/services/live-activities";

const registerSchema = z.object({
  token: z.string().min(1),
});

export const POST = withAuth(async (req, { user }) => {
  const body = registerSchema.parse(await req.json());

  await registerCheckoutReturnLiveActivityStartToken({
    userId: user.id,
    token: body.token,
  });

  return ok({ success: true });
});

export const DELETE = withAuth(async (_req, { user }) => {
  await revokeCheckoutReturnLiveActivityStartTokens(user.id);

  return ok({ success: true });
});
