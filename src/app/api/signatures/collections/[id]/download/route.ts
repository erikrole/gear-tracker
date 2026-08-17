import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { getSignatureCollectionZip } from "@/lib/services/signatures";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "signature", "download");
  await enforceRateLimit(`signature-download-all:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const archive = await getSignatureCollectionZip(params.id);
  return new NextResponse(Uint8Array.from(archive.body), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(archive.body.byteLength),
      "Content-Disposition": `attachment; filename="${archive.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
