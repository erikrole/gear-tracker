import { del, get, put, type GetBlobResult } from "@vercel/blob";

export type SignatureArtifactKind = "png" | "svg";

export function isPrivateSignatureStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

export function assertPrivateSignatureStorageConfigured(): void {
  if (!isPrivateSignatureStorageConfigured()) {
    throw new Error("Private signature Blob storage is not configured");
  }
}

export function buildSignatureArtifactPath(
  collectionId: string,
  memberId: string,
  revisionId: string,
  kind: SignatureArtifactKind,
): string {
  return `signatures/${collectionId}/${memberId}/${revisionId}.${kind}`;
}

export async function uploadPrivateSignatureArtifact(input: {
  path: string;
  body: Buffer;
  contentType: "image/png" | "image/svg+xml";
}): Promise<void> {
  assertPrivateSignatureStorageConfigured();
  await put(input.path, input.body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: input.contentType,
    cacheControlMaxAge: 60,
  });
}

export async function deletePrivateSignatureArtifacts(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  assertPrivateSignatureStorageConfigured();
  await del(paths);
}

export async function getPrivateSignatureArtifact(
  path: string,
): Promise<Extract<GetBlobResult, { statusCode: 200 }> | null> {
  assertPrivateSignatureStorageConfigured();
  const result = await get(path, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return result;
}
