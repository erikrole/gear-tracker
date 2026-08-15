import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, SignatureCollectionStatus, SignatureSaveStatus } from "@prisma/client";

const { dbMock, tx } = vi.hoisted(() => {
  const tx = {
    signatureCapture: {
      findUnique: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    signatureCollection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    signatureMember: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    signatureArtifactRevision: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    signatureSaveOperation: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const dbMock = {
    $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
    signatureSaveOperation: { findUnique: vi.fn() },
    signatureCapture: { findFirst: vi.fn() },
    signatureCollection: { findUnique: vi.fn() },
    signatureArtifactRevision: { findUnique: vi.fn() },
  };

  return { dbMock, tx };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/audit", () => ({
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@/lib/signatures/artifacts", () => ({
  renderSignatureArtifacts: vi.fn(),
}));

vi.mock("@/lib/signatures/storage", () => ({
  buildSignatureArtifactPath: vi.fn((collectionId: string, memberId: string, revisionId: string, kind: string) => `signatures/${collectionId}/${memberId}/${revisionId}.${kind}`),
  uploadPrivateSignatureArtifact: vi.fn(),
  deletePrivateSignatureArtifacts: vi.fn(),
}));

import { ensureSignatureCreativeStaffCollection, saveSignatureCapture, syncSignatureCreativeStaff } from "@/lib/services/signatures";
import { renderSignatureArtifacts } from "@/lib/signatures/artifacts";
import { deletePrivateSignatureArtifacts, uploadPrivateSignatureArtifact } from "@/lib/signatures/storage";

const actor = { id: "staff-1", role: Role.STAFF };
const request = {
  requestId: "request-123456789012",
  expectedCaptureVersion: 0,
  settingsVersion: 1,
  strokes: [{ points: [{ x: 10, y: 10 }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.signatureSaveOperation.findUnique.mockResolvedValue(null);
  dbMock.signatureCapture.findFirst.mockResolvedValue({
    id: "capture-1",
    captureVersion: 0,
    settingsVersion: 1,
    collection: {
      status: SignatureCollectionStatus.OPEN,
      settingsVersion: 1,
      penSettings: {
        strokeColor: "#111827",
        strokeWidth: 4,
        cropPadding: 24,
        maxWidth: 1600,
        maxHeight: 900,
      },
    },
    member: { id: "member-1", active: true },
    currentRevision: null,
  });
  tx.signatureCapture.findUnique.mockResolvedValue({
    captureVersion: 0,
    collectionId: "collection-1",
    memberId: "member-1",
    settingsVersion: 1,
  });
  tx.signatureArtifactRevision.findFirst.mockResolvedValue(null);
  tx.signatureArtifactRevision.create.mockResolvedValue({ id: "revision-1" });
  tx.signatureSaveOperation.create.mockResolvedValue({ id: "operation-1" });
  tx.signatureArtifactRevision.updateMany.mockResolvedValue({ count: 1 });
  tx.signatureSaveOperation.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(renderSignatureArtifacts).mockResolvedValue({
    svg: "<svg />",
    png: Buffer.from("png"),
    pngHash: "png-hash",
    svgHash: "svg-hash",
    width: 100,
    height: 80,
    cropBounds: { x: 0, y: 0, width: 100, height: 80 },
  });
});

describe("signature save lifecycle", () => {
  it("binds an idempotency key to its original signature target", async () => {
    dbMock.signatureSaveOperation.findUnique.mockResolvedValue({
      collectionId: "other-collection",
      memberId: "other-member",
      actorUserId: actor.id,
      expectedCaptureVersion: request.expectedCaptureVersion,
      settingsVersion: request.settingsVersion,
      status: SignatureSaveStatus.COMMITTED,
      revision: null,
    });

    await expect(saveSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", request })).rejects.toMatchObject({ status: 409 });
    expect(dbMock.signatureCapture.findFirst).not.toHaveBeenCalled();
    expect(renderSignatureArtifacts).not.toHaveBeenCalled();
  });

  it("keeps the current capture when the second artifact upload fails", async () => {
    vi.mocked(uploadPrivateSignatureArtifact)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("SVG store unavailable"));

    await expect(saveSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", request })).rejects.toMatchObject({
      status: 503,
    });

    expect(uploadPrivateSignatureArtifact).toHaveBeenCalledTimes(2);
    expect(deletePrivateSignatureArtifacts).toHaveBeenCalledTimes(1);
    expect(tx.signatureCapture.update).not.toHaveBeenCalled();
    expect(tx.signatureSaveOperation.update).not.toHaveBeenCalled();
    expect(tx.signatureSaveOperation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "operation-1", status: { not: "COMMITTED" } },
      data: expect.objectContaining({ status: "FAILED" }),
    }));
  });
});

describe("Creative staff roster sync", () => {
  it("creates a standalone Creative staff collection", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue(null);
    tx.signatureCollection.create.mockResolvedValue({
      id: "creative-collection-1",
      sportCode: "CREATIVE",
      season: "2026-27",
      status: SignatureCollectionStatus.OPEN,
      collectionVersion: 1,
    });

    await expect(ensureSignatureCreativeStaffCollection({ actor, season: "2026-27" })).resolves.toMatchObject({
      id: "creative-collection-1",
      sportCode: "CREATIVE",
      season: "2026-27",
      created: true,
    });
    expect(tx.signatureCollection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sportCode: "CREATIVE", season: "2026-27" }),
      select: expect.any(Object),
    });
  });

  it("adds active staff/admin users as required linked members", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "CREATIVE", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });
    tx.user.findMany.mockResolvedValue([{ id: "user-1", name: "Erik Role", title: "Creative Director" }]);
    tx.signatureMember.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "member-1" }]);
    tx.signatureMember.create.mockResolvedValue({ id: "member-1" });
    tx.signatureCapture.createMany.mockResolvedValue({ count: 1 });
    tx.signatureCollection.update.mockResolvedValue({ collectionVersion: 5 });

    await expect(syncSignatureCreativeStaff({
      actor,
      collectionId: "collection-1",
      expectedCollectionVersion: 4,
    })).resolves.toMatchObject({
      activeCount: 1,
      added: 1,
      collectionVersion: 5,
      unchanged: false,
    });

    expect(tx.signatureMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceExternalId: "creative-staff:user-1",
        linkedUserId: "user-1",
        roleGroup: "CREATIVE_STAFF",
        required: true,
      }),
    });
    expect(tx.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        active: true,
        hiddenFromRoster: false,
        staffingType: "FT",
        OR: expect.any(Array),
      }),
    }));
  });

  it("is version-checked and leaves an unchanged roster idempotent", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "CREATIVE", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });
    tx.user.findMany.mockResolvedValue([{ id: "user-1", name: "Erik Role", title: "Creative Director" }]);
    tx.signatureMember.findMany
      .mockResolvedValueOnce([{ id: "member-1", linkedUserId: "user-1", required: true, active: true, name: "Erik Role", title: "Creative Director" }])
      .mockResolvedValueOnce([{ id: "member-1" }]);
    tx.signatureCapture.createMany.mockResolvedValue({ count: 0 });

    await expect(syncSignatureCreativeStaff({
      actor,
      collectionId: "collection-1",
      expectedCollectionVersion: 4,
    })).resolves.toMatchObject({ unchanged: true, collectionVersion: 4, activeCount: 1 });

    expect(tx.signatureCollection.update).not.toHaveBeenCalled();
    expect(tx.signatureMember.create).not.toHaveBeenCalled();
  });

  it("rejects attempts to nest Creative staff inside a team roster", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "MBB", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });

    await expect(syncSignatureCreativeStaff({
      actor,
      collectionId: "collection-1",
      expectedCollectionVersion: 4,
    })).rejects.toMatchObject({ status: 409 });
    expect(tx.user.findMany).not.toHaveBeenCalled();
  });
});
