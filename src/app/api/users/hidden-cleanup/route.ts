import { z } from "zod";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { cleanupHiddenUsers } from "@/lib/services/hidden-users-cleanup";
import { canViewHiddenUsers } from "@/lib/user-visibility";

const hiddenCleanupSchema = z.object({
  dryRun: z.boolean().default(true),
  maxAgeDays: z.number().int().min(1).max(365).default(14),
  limit: z.number().int().min(1).max(100).default(25),
});

export const POST = withAuth(async (req, { user }) => {
  if (!canViewHiddenUsers(user)) {
    throw new HttpError(403, "Forbidden");
  }

  const body = hiddenCleanupSchema.parse(await req.json().catch(() => ({})));
  const result = await cleanupHiddenUsers({
    actor: { id: user.id, role: user.role },
    dryRun: body.dryRun,
    maxAgeDays: body.maxAgeDays,
    limit: body.limit,
  });

  return ok({ data: result });
});
