import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { deleteSignatureCollection, getSignatureCollection, updateSignaturePenSettings } from "@/lib/services/signatures";
import { signatureCollectionVersionSchema, signatureSettingsUpdateSchema } from "@/lib/signatures/types";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "signature", "view");
  return ok(await getSignatureCollection(params.id));
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "settings");
  await enforceRateLimit(`signature-settings:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureSettingsUpdateSchema.parse(await req.json());
  const updated = await updateSignaturePenSettings({
    actor: user,
    collectionId: params.id,
    expectedCollectionVersion: body.expectedCollectionVersion,
    expectedSettingsVersion: body.expectedSettingsVersion,
    settings: {
      strokeColor: body.strokeColor,
      strokeWidth: body.strokeWidth,
      cropPadding: body.cropPadding,
      maxWidth: body.maxWidth,
      maxHeight: body.maxHeight,
    },
  });
  return ok(updated);
});

export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "delete");
  await enforceRateLimit(`signature-delete:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = signatureCollectionVersionSchema.parse(await req.json());
  return ok(await deleteSignatureCollection({ actor: user, collectionId: params.id, expectedCollectionVersion: body.expectedCollectionVersion }));
});
