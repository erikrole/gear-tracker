import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_IMPORT_LIMIT } from "@/lib/rate-limit";
import { createSignatureRosterPreview } from "@/lib/services/signatures";
import { fetchUWBadgersRoster } from "@/lib/signatures/uwbadgers";
import { signatureSeasonSchema } from "@/lib/signatures/types";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "signature", "import");
  await enforceRateLimit(`signature-import:${user.id}`, SIGNATURE_IMPORT_LIMIT);
  const body = (await req.json()) as { season?: unknown };
  const season = signatureSeasonSchema.parse(body.season);
  const snapshot = await fetchUWBadgersRoster(season);
  const preview = await createSignatureRosterPreview({ actor: user, season, ...snapshot });
  return ok({
    ...preview,
    sourceUrl: snapshot.sourceUrl,
    sourceHash: snapshot.sourceHash,
    parserVersion: snapshot.parserVersion,
    entries: snapshot.entries,
  }, 201);
});
