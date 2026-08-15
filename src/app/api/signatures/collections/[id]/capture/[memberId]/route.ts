import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit, SIGNATURE_CAPTURE_LIMIT, SIGNATURE_MUTATION_LIMIT } from "@/lib/rate-limit";
import { saveSignatureCapture } from "@/lib/services/signatures";
import { removeSignatureCapture } from "@/lib/services/signatures";
import { captureSaveRequestSchema, SIGNATURE_MAX_PAYLOAD_BYTES } from "@/lib/signatures/types";
import { z } from "zod";

async function readBoundedBody(req: Request): Promise<string> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > SIGNATURE_MAX_PAYLOAD_BYTES) throw new HttpError(413, "Signature payload is too large");

  const reader = req.body?.getReader();
  if (!reader) {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > SIGNATURE_MAX_PAYLOAD_BYTES) throw new HttpError(413, "Signature payload is too large");
    return raw;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > SIGNATURE_MAX_PAYLOAD_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Signature payload is too large");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export const POST = withAuth<{ id: string; memberId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "capture");
  await enforceRateLimit(`signature-capture:${user.id}`, SIGNATURE_CAPTURE_LIMIT);
  const raw = await readBoundedBody(req);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON payload"); }
  const body = captureSaveRequestSchema.parse(json);
  return ok(await saveSignatureCapture({ actor: user, collectionId: params.id, memberId: params.memberId, request: body }));
});

const removeSchema = z.object({ expectedCaptureVersion: z.number().int().min(0) });

export const DELETE = withAuth<{ id: string; memberId: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "signature", "remove");
  await enforceRateLimit(`signature-remove:${user.id}`, SIGNATURE_MUTATION_LIMIT);
  const body = removeSchema.parse(await req.json());
  return ok(await removeSignatureCapture({ actor: user, collectionId: params.id, memberId: params.memberId, ...body }));
});
