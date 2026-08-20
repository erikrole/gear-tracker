import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermissionOrCollaboratorCapability } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { revealSoftwarePassword } from "@/lib/services/software";

const REVEAL_LIMIT = { max: 20, windowMs: 5 * 60_000 };

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermissionOrCollaboratorCapability(user, "software", "reveal", "SOFTWARE_VAULT_VIEW");
  const { allowed } = await checkRateLimit(`software:reveal:${user.id}`, REVEAL_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many password reveals. Please wait a few minutes.");

  const credential = await revealSoftwarePassword(params.id, {
    id: user.id,
    role: user.role,
    collaboratorCanView: user.role === "COLLABORATOR",
  });

  return ok({ data: { password: credential.password } });
});
