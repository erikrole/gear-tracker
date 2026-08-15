import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { ensureSignatureCreativeStaffCollection, listSignatureCollections } from "@/lib/services/signatures";
import { SIGNATURE_CREATIVE_STAFF_SPORT_CODE, SIGNATURE_MBB_SPORT_CODE } from "@/lib/signatures/types";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "signature", "view");
  const includeArchived = user.role === "ADMIN" && new URL(req.url).searchParams.get("includeArchived") === "true";
  let collections = await listSignatureCollections({ includeArchived });
  const currentMbb = collections.find((collection) => collection.sportCode === SIGNATURE_MBB_SPORT_CODE && collection.status === "OPEN");
  const hasCreativeStaffRoster = currentMbb && collections.some((collection) => collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE && collection.season === currentMbb.season);
  if (currentMbb && !hasCreativeStaffRoster) {
    await ensureSignatureCreativeStaffCollection({ actor: user, season: currentMbb.season });
    collections = await listSignatureCollections({ includeArchived });
  }
  return ok({ collections });
});
