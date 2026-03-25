import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { removeKitMember } from "@/lib/services/kits";

export const DELETE = withAuth<{ id: string; membershipId: string }>(
  async (_req, { user, params }) => {
    requirePermission(user.role, "kit", "edit");
    await removeKitMember(params.id, params.membershipId, user.id, user.role);
    return ok({ success: true });
  }
);
