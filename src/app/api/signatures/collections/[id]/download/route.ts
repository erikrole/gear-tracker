import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { getSignatureCollectionZip } from "@/lib/services/signatures";
import { isSignatureZipFormat } from "@/lib/signatures/zip";

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "download");
  await enforceRateLimit(`signature-download-all:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const format = new URL(req.url).searchParams.get("format") ?? "svg";
  if (!isSignatureZipFormat(format)) throw new HttpError(400, "Signature ZIP format must be png or svg");
  const archive = await getSignatureCollectionZip(params.id, format);
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
