import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { resetSignatureCollection } from "@/lib/services/signatures";
import { z } from "zod";

const resetSchema = z.object({ expectedCollectionVersion: z.number().int().min(1) });

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "reset");
  await enforceRateLimit(`signature-reset:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = resetSchema.parse(await req.json());
  return ok(await resetSignatureCollection({ actor: user, collectionId: params.id, ...body }));
});
