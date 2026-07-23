import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import {
  endCheckoutReturnLiveActivitiesForUser,
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

// Called on sign-out. Both halves matter: the start tokens stop this device
// being woken for future checkouts, and the activity tokens stop us pushing
// updates at an activity the departing user's app has already ended.
export const DELETE = withAuth(async (_req, { user }) => {
  await Promise.all([
    revokeCheckoutReturnLiveActivityStartTokens(user.id),
    endCheckoutReturnLiveActivitiesForUser(user.id),
  ]);

  return ok({ success: true });
});
