import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getReadySignatureArtifact } from "@/lib/services/signatures";
import { renderSignaturePngFromSvg } from "@/lib/signatures/artifacts";
import { getPrivateSignatureArtifact } from "@/lib/signatures/storage";

export const GET = withAuth<{ revisionId: string; kind: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "download");
  if (params.kind !== "png" && params.kind !== "svg") throw new HttpError(400, "Unsupported signature artifact type");
  const artifact = await getReadySignatureArtifact(params.revisionId, params.kind);
  const downloadRequested = new URL(req.url).searchParams.get("download") === "1";

  if (params.kind === "png" && downloadRequested) {
    const vectorArtifact = await getReadySignatureArtifact(params.revisionId, "svg");
    const vectorBlob = await getPrivateSignatureArtifact(vectorArtifact.path);
    if (!vectorBlob) throw new HttpError(404, "Signature artifact not found");
    const svg = await new Response(vectorBlob.stream).text();
    const rendered = await renderSignaturePngFromSvg(svg);
    return new NextResponse(Uint8Array.from(rendered.png), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Length": String(rendered.png.byteLength),
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const blob = await getPrivateSignatureArtifact(artifact.path);
  if (!blob) throw new HttpError(404, "Signature artifact not found");
  const disposition = params.kind === "svg" || downloadRequested ? "attachment" : "inline";
  const vectorBody = params.kind === "svg"
    ? Uint8Array.from(new Uint8Array(await new Response(blob.stream).arrayBuffer()))
    : null;
  const body = vectorBody ?? blob.stream;
  const contentLength = vectorBody?.byteLength ?? blob.blob.size;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": artifact.contentType,
      "Content-Length": String(contentLength),
      "Content-Disposition": `${disposition}; filename="${artifact.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
