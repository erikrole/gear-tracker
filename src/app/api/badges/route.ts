import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { badgesEnabled } from "@/lib/badges";
import { listActiveBadgeDefinitions } from "@/lib/badges/queries";

export const GET = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF", "STUDENT"]);
  if (!badgesEnabled()) {
    return ok({ data: [], disabled: true });
  }

  const { searchParams } = new URL(req.url);
  const manualOnly = searchParams.get("manualOnly") === "true";
  const definitions = await listActiveBadgeDefinitions(manualOnly ? { trigger: "manual" } : undefined);

  return ok({
    data: definitions.map((definition) => ({
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      kind: definition.kind,
      threshold: definition.threshold,
      ruleKey: definition.ruleKey,
      active: definition.active,
      sortOrder: definition.sortOrder,
    })),
  });
});
