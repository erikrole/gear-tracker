import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getReadySignatureArtifact } from "@/lib/services/signatures";
import { getPrivateSignatureArtifact } from "@/lib/signatures/storage";

export const GET = withAuth<{ revisionId: string; kind: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "signature", "download");
  if (params.kind !== "png" && params.kind !== "svg") throw new HttpError(400, "Unsupported signature artifact type");
  const artifact = await getReadySignatureArtifact(params.revisionId, params.kind);
  const blob = await getPrivateSignatureArtifact(artifact.path);
  if (!blob) throw new HttpError(404, "Signature artifact not found");
  const disposition = params.kind === "svg" ? "attachment" : "inline";
  return new NextResponse(blob.stream, {
    status: 200,
    headers: {
      "Content-Type": artifact.contentType,
      "Content-Length": String(blob.blob.size),
      "Content-Disposition": `${disposition}; filename="${artifact.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
