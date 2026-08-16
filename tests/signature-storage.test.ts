import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

import { del, get, put } from "@vercel/blob";
import {
  deletePrivateSignatureArtifacts,
  getPrivateSignatureArtifact,
  isPrivateSignatureStorageConfigured,
  uploadPrivateSignatureArtifact,
} from "@/lib/signatures/storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.SIGNATURE_BLOB_READ_WRITE_TOKEN;
  delete process.env.SIGNATURE_BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;
});

describe("private signature Blob storage", () => {
  it("does not treat the public-media token as signature storage", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "public-token");

    expect(isPrivateSignatureStorageConfigured()).toBe(false);
    await expect(uploadPrivateSignatureArtifact({ path: "signature.png", body: Buffer.from("png"), contentType: "image/png" })).rejects.toThrow("Private Signature Blob storage is not configured");
    expect(put).not.toHaveBeenCalled();
  });

  it("passes the dedicated private token to upload, read, and cleanup calls", async () => {
    vi.stubEnv("SIGNATURE_BLOB_READ_WRITE_TOKEN", "private-token");
    vi.mocked(put).mockResolvedValue({} as never);
    vi.mocked(del).mockResolvedValue(undefined);
    vi.mocked(get).mockResolvedValue({ statusCode: 200 } as never);

    expect(isPrivateSignatureStorageConfigured()).toBe(true);
    await uploadPrivateSignatureArtifact({ path: "signature.png", body: Buffer.from("png"), contentType: "image/png" });
    await getPrivateSignatureArtifact("signature.png");
    await deletePrivateSignatureArtifacts(["signature.png"]);

    expect(put).toHaveBeenCalledWith("signature.png", expect.any(Buffer), expect.objectContaining({ access: "private", token: "private-token" }));
    expect(get).toHaveBeenCalledWith("signature.png", expect.objectContaining({ access: "private", token: "private-token" }));
    expect(del).toHaveBeenCalledWith(["signature.png"], expect.objectContaining({ token: "private-token" }));
  });

  it("supports Vercel OIDC when a dedicated store ID is configured", async () => {
    vi.stubEnv("SIGNATURE_BLOB_STORE_ID", "store_private");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-token");
    vi.mocked(put).mockResolvedValue({} as never);

    await uploadPrivateSignatureArtifact({ path: "signature.png", body: Buffer.from("png"), contentType: "image/png" });

    expect(put).toHaveBeenCalledWith("signature.png", expect.any(Buffer), expect.objectContaining({ access: "private", storeId: "store_private", oidcToken: "oidc-token" }));
  });
});
