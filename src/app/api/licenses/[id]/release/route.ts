import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { releaseCode } from "@/lib/services/licenses";

const bodySchema = z.object({ claimId: z.string().optional(), all: z.boolean().optional() }).optional();
const RELEASE_LIMIT = { max: 20, windowMs: 60_000 };

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "license", "release");
  const { allowed } = await checkRateLimit(`license:release:${user.id}`, RELEASE_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many requests. Please wait a moment.");
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";

  let claimId: string | undefined;
  let releaseAll = false;
  try {
    const body = bodySchema.parse(await req.json());
    claimId = body?.claimId;
    releaseAll = body?.all === true;
  } catch {
    // empty body is fine
  }

  const code = await releaseCode(params.id, user.id, isAdmin, { claimId, releaseAll }, user.role);

  return ok({ data: code });
});
