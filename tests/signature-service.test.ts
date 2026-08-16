import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, SignatureCollectionStatus, SignatureSaveStatus } from "@prisma/client";

const { dbMock, tx } = vi.hoisted(() => {
  const tx = {
    signatureCapture: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    signatureCollection: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    signatureRosterSnapshot: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    signatureMember: {
      findFirst: vi.fn(),
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
    signatureSaveOperation: { findUnique: vi.fn(), update: vi.fn() },
    signatureCapture: { findFirst: vi.fn() },
    signatureCollection: { findUnique: vi.fn() },
    signatureArtifactRevision: { findUnique: vi.fn(), updateMany: vi.fn() },
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

import { createAdHocSignatureMember, createSignatureRosterPreview, ensureSignatureCreativeStaffCollection, getReadySignatureArtifact, removeSignatureCapture, resetSignatureCollection, saveSignatureCapture, signatureArtifactFilename, syncSignatureCreativeStaff, updateSignatureMemberRequired } from "@/lib/services/signatures";
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
    collectionId: "collection-1",
    memberId: "member-1",
    captureVersion: 0,
    settingsVersion: 1,
    collection: {
      id: "collection-1",
      sportCode: "MBB",
      season: "2026-27",
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
    member: { id: "member-1", active: true, linkedUserId: null },
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
    expect(dbMock.signatureCapture.findFirst).toHaveBeenCalledTimes(1);
    expect(renderSignatureArtifacts).not.toHaveBeenCalled();
  });

  it("distinguishes an in-progress idempotent retry from a failed operation", async () => {
    const existing = {
      collectionId: "collection-1",
      memberId: "member-1",
      actorUserId: actor.id,
      expectedCaptureVersion: request.expectedCaptureVersion,
      settingsVersion: request.settingsVersion,
      revision: null,
    };
    dbMock.signatureSaveOperation.findUnique.mockResolvedValue({
      ...existing,
      status: SignatureSaveStatus.UPLOADING,
    });
    await expect(saveSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", request })).rejects.toMatchObject({
      status: 425,
      message: "This signature is still saving; try again shortly",
    });

    dbMock.signatureSaveOperation.findUnique.mockResolvedValue({
      ...existing,
      status: SignatureSaveStatus.FAILED,
    });
    await expect(saveSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", request })).rejects.toMatchObject({
      status: 409,
      message: "This save request failed; try saving again",
    });
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

  it("retains the prior READY revision when a recapture commits", async () => {
    const priorRevision = { id: "revision-old", pngHash: "old-png", svgHash: "old-svg" };
    dbMock.signatureCapture.findFirst.mockResolvedValue({
      id: "capture-1",
      collectionId: "collection-1",
      memberId: "member-1",
      captureVersion: 0,
      settingsVersion: 1,
      collection: {
        id: "collection-1",
        sportCode: "MBB",
        season: "2026-27",
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
      member: { id: "member-1", active: true, linkedUserId: null },
      currentRevision: priorRevision,
    });
    tx.signatureCapture.findUnique
      .mockResolvedValueOnce({ captureVersion: 0, collectionId: "collection-1", memberId: "member-1", settingsVersion: 1 })
      .mockResolvedValueOnce({
        id: "capture-1",
        captureVersion: 0,
        settingsVersion: 1,
        currentRevisionId: "revision-old",
        currentRevision: priorRevision,
        collection: { status: SignatureCollectionStatus.OPEN },
        member: { active: true },
      });
    tx.signatureArtifactRevision.findFirst.mockResolvedValue({ revision: 1 });
    tx.signatureArtifactRevision.update
      .mockResolvedValueOnce(priorRevision)
      .mockResolvedValueOnce({
        id: "revision-1",
        revision: 2,
        state: "READY",
        width: 100,
        height: 80,
        pngHash: "png-hash",
        svgHash: "svg-hash",
        committedAt: new Date("2026-08-16T12:00:00Z"),
        replacedAt: null,
      });
    tx.signatureCapture.update.mockResolvedValue({ captureVersion: 1 });
    tx.signatureCollection.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(uploadPrivateSignatureArtifact).mockResolvedValue(undefined);

    await expect(saveSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", request })).resolves.toMatchObject({
      status: "committed",
      captureVersion: 1,
      revision: { revision: 2 },
    });

    expect(tx.signatureArtifactRevision.update).toHaveBeenNthCalledWith(1, {
      where: { id: "revision-old" },
      data: { replacedAt: expect.any(Date) },
    });
    expect(deletePrivateSignatureArtifacts).not.toHaveBeenCalled();
  });

  it("writes a linked team member through the same-season Creative Staff capture", async () => {
    dbMock.signatureCapture.findFirst
      .mockResolvedValueOnce({
        id: "team-capture",
        collectionId: "team-collection",
        memberId: "team-member",
        captureVersion: 0,
        settingsVersion: 1,
        collection: { id: "team-collection", sportCode: "MBB", season: "2026-27", status: SignatureCollectionStatus.OPEN, settingsVersion: 1, penSettings: {} },
        member: { id: "team-member", active: true, linkedUserId: "user-1" },
        currentRevision: null,
      })
      .mockResolvedValueOnce({
        id: "creative-capture",
        collectionId: "creative-collection",
        memberId: "creative-member",
        captureVersion: 0,
        settingsVersion: 1,
        collection: {
          id: "creative-collection",
          sportCode: "CREATIVE",
          season: "2026-27",
          status: SignatureCollectionStatus.OPEN,
          settingsVersion: 1,
          penSettings: { strokeColor: "#111827", strokeWidth: 4, cropPadding: 24, maxWidth: 1600, maxHeight: 900 },
        },
        member: { id: "creative-member", active: true, linkedUserId: "user-1" },
        currentRevision: null,
      });
    tx.signatureCapture.findUnique
      .mockResolvedValueOnce({ captureVersion: 0, collectionId: "creative-collection", memberId: "creative-member", settingsVersion: 1 })
      .mockResolvedValueOnce({
        id: "creative-capture",
        captureVersion: 0,
        settingsVersion: 1,
        currentRevisionId: null,
        currentRevision: null,
        collection: { status: SignatureCollectionStatus.OPEN },
        member: { active: true },
      });
    tx.signatureCapture.update.mockResolvedValue({ captureVersion: 1 });
    tx.signatureCollection.updateMany.mockResolvedValue({ count: 1 });
    tx.signatureArtifactRevision.update.mockResolvedValue({
      id: "revision-1",
      revision: 1,
      state: "READY",
      width: 100,
      height: 80,
      pngHash: "png-hash",
      svgHash: "svg-hash",
      committedAt: new Date("2026-08-16T12:00:00Z"),
      replacedAt: null,
    });
    vi.mocked(uploadPrivateSignatureArtifact).mockResolvedValue(undefined);

    await expect(saveSignatureCapture({ actor, collectionId: "team-collection", memberId: "team-member", request })).resolves.toMatchObject({ status: "committed", captureVersion: 1 });

    expect(tx.signatureSaveOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ collectionId: "creative-collection", memberId: "creative-member", captureId: "creative-capture" }),
    });
    expect(uploadPrivateSignatureArtifact).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringMatching(/^signatures\/creative-collection\/creative-member\//) }));
  });
});

describe("signature download filenames", () => {
  it("uses clean signer filenames without internal IDs", () => {
    expect(signatureArtifactFilename("Erik Role", "png")).toBe("erik-role-signature.png");
    expect(signatureArtifactFilename("José O’Neill Jr.", "svg")).toBe("jose-oneill-jr-signature.svg");
    expect(signatureArtifactFilename("---", "png")).toBe("signature.png");
    expect(signatureArtifactFilename("Erik Role", "svg", 2)).toBe("erik-role-signature-v2.svg");
  });

  it("allows a retained READY revision to download with a versioned filename", async () => {
    dbMock.signatureArtifactRevision.findUnique.mockResolvedValue({
      id: "revision-2",
      revision: 2,
      state: "READY",
      pngPath: "old.png",
      svgPath: "old.svg",
      capture: {
        currentRevisionId: "revision-3",
        member: { name: "Erik Role" },
      },
    });

    await expect(getReadySignatureArtifact("revision-2", "png")).resolves.toMatchObject({
      path: "old.png",
      filename: "erik-role-signature-v2.png",
    });
  });
});

describe("signature history erasure", () => {
  it("removes every retained revision for one signer", async () => {
    tx.signatureCapture.findUnique.mockResolvedValue({
      id: "capture-1",
      captureVersion: 3,
      currentRevision: { id: "revision-3", pngHash: "png-3", svgHash: "svg-3" },
      collection: { status: SignatureCollectionStatus.OPEN },
      revisions: [
        { id: "revision-2", pngPath: "two.png", svgPath: "two.svg" },
        { id: "revision-3", pngPath: "three.png", svgPath: "three.svg" },
      ],
    });
    tx.signatureCapture.update.mockResolvedValue({ captureVersion: 4 });
    tx.signatureArtifactRevision.updateMany.mockResolvedValue({ count: 2 });
    dbMock.signatureArtifactRevision.updateMany.mockResolvedValue({ count: 1 });

    await expect(removeSignatureCapture({ actor, collectionId: "collection-1", memberId: "member-1", expectedCaptureVersion: 3 })).resolves.toEqual({
      removed: true,
      captureVersion: 4,
    });

    expect(tx.signatureArtifactRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["revision-2", "revision-3"] } },
      data: expect.objectContaining({ state: "PENDING_DELETE" }),
    }));
    expect(deletePrivateSignatureArtifacts).toHaveBeenCalledWith(["two.png", "two.svg"]);
    expect(deletePrivateSignatureArtifacts).toHaveBeenCalledWith(["three.png", "three.svg"]);
  });

  it("resets all retained revisions across the collection", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", status: SignatureCollectionStatus.OPEN, collectionVersion: 5 });
    tx.signatureCapture.findMany.mockResolvedValue([
      {
        id: "capture-1",
        currentRevisionId: "revision-2",
        captureVersion: 2,
        revisions: [
          { id: "revision-1", pngPath: "one.png", svgPath: "one.svg" },
          { id: "revision-2", pngPath: "two.png", svgPath: "two.svg" },
        ],
      },
    ]);
    tx.signatureCapture.updateMany.mockResolvedValue({ count: 1 });
    tx.signatureArtifactRevision.updateMany.mockResolvedValue({ count: 2 });
    tx.signatureCollection.update.mockResolvedValue({ collectionVersion: 6 });
    dbMock.signatureArtifactRevision.updateMany.mockResolvedValue({ count: 1 });

    await expect(resetSignatureCollection({ actor, collectionId: "collection-1", expectedCollectionVersion: 5 })).resolves.toEqual({
      collectionVersion: 6,
      resetCount: 1,
    });

    expect(tx.signatureArtifactRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["revision-1", "revision-2"] } },
      data: expect.objectContaining({ state: "PENDING_DELETE" }),
    }));
  });
});

describe("sport roster previews", () => {
  it.each(["FB", "VB"] as const)("creates a %s collection preview without falling back to MBB", async (sportCode) => {
    tx.signatureCollection.upsert.mockResolvedValue({
      id: `${sportCode.toLowerCase()}-collection`,
      collectionVersion: 1,
      status: SignatureCollectionStatus.OPEN,
    });
    tx.signatureRosterSnapshot.findUnique.mockResolvedValue(null);
    tx.signatureRosterSnapshot.create.mockResolvedValue({
      id: `${sportCode.toLowerCase()}-snapshot`,
      createdAt: new Date("2026-08-16T12:00:00Z"),
    });

    await expect(createSignatureRosterPreview({
      actor,
      sportCode,
      season: "2026-27",
      sourceUrl: `https://uwbadgers.com/${sportCode.toLowerCase()}`,
      sourceHash: `${sportCode.toLowerCase()}-hash`,
      parserVersion: `uwbadgers-${sportCode.toLowerCase()}-v1`,
      fetchedAt: new Date("2026-08-16T12:00:00Z"),
      entries: [{
        sourceExternalId: `${sportCode.toLowerCase()}-player-1`,
        sourceProfileUrl: "https://uwbadgers.com/sports/roster/player/1",
        name: "Test Player",
        normalizedName: "test player",
        jerseyNumber: 1,
        roleGroup: "PLAYER",
        title: "Guard • Junior",
      }],
    })).resolves.toMatchObject({
      collectionId: `${sportCode.toLowerCase()}-collection`,
      snapshotId: `${sportCode.toLowerCase()}-snapshot`,
      candidateCount: 1,
    });

    expect(tx.signatureCollection.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { sportCode_season: { sportCode, season: "2026-27" } },
      create: expect.objectContaining({ sportCode, season: "2026-27" }),
    }));
    expect(tx.signatureRosterSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceKey: `UW_BADGERS_${sportCode}` }),
    }));
  });
});

describe("ad-hoc signatures", () => {
  it("creates a required manual signer and capture in the season ad-hoc roster", async () => {
    tx.signatureCollection.upsert.mockResolvedValue({
      id: "ad-hoc-collection",
      status: SignatureCollectionStatus.OPEN,
      collectionVersion: 2,
      settingsVersion: 1,
    });
    tx.signatureMember.create.mockResolvedValue({ id: "member-1", name: "Bucky Badger", title: "Alumni" });
    tx.signatureCapture.create.mockResolvedValue({ id: "capture-1" });
    tx.signatureCollection.update.mockResolvedValue({ collectionVersion: 3 });

    await expect(createAdHocSignatureMember({
      actor,
      season: "2026-27",
      name: "  Bucky Badger  ",
      category: " Alumni ",
    })).resolves.toMatchObject({
      collectionId: "ad-hoc-collection",
      memberId: "member-1",
      collectionVersion: 3,
    });

    expect(tx.signatureMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        collectionId: "ad-hoc-collection",
        name: "Bucky Badger",
        normalizedName: "bucky badger",
        roleGroup: "SUPPORT_STAFF",
        title: "Alumni",
        required: true,
      }),
      select: expect.any(Object),
    });
    expect(tx.signatureCapture.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ collectionId: "ad-hoc-collection", memberId: "member-1" }),
    });
  });
});

describe("signature readiness requirements", () => {
  it("rejects making a player optional", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ collectionVersion: 4, status: SignatureCollectionStatus.OPEN });
    tx.signatureMember.findFirst.mockResolvedValue({ id: "player-1", required: true, roleGroup: "PLAYER" });

    await expect(updateSignatureMemberRequired({
      actor,
      collectionId: "collection-1",
      memberId: "player-1",
      required: false,
      expectedCollectionVersion: 4,
    })).rejects.toMatchObject({ status: 400, message: "Players always require a signature" });

    expect(tx.signatureMember.update).not.toHaveBeenCalled();
    expect(tx.signatureCollection.update).not.toHaveBeenCalled();
  });

  it("keeps readiness controls available for non-player members", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ collectionVersion: 4, status: SignatureCollectionStatus.OPEN });
    tx.signatureMember.findFirst.mockResolvedValue({ id: "staff-1", required: true, roleGroup: "SUPPORT_STAFF" });
    tx.signatureMember.update.mockResolvedValue({ id: "staff-1" });
    tx.signatureCollection.update.mockResolvedValue({ collectionVersion: 5 });

    await expect(updateSignatureMemberRequired({
      actor,
      collectionId: "collection-1",
      memberId: "staff-1",
      required: false,
      expectedCollectionVersion: 4,
    })).resolves.toEqual({ collectionVersion: 5 });

    expect(tx.signatureMember.update).toHaveBeenCalledWith({ where: { id: "staff-1" }, data: { required: false } });
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

  it("adds active full-time staff identified by area or creative job title", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "CREATIVE", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });
    tx.user.findMany.mockResolvedValue([{ id: "user-jerry", name: "Jerry Mao", title: "Creative Director" }]);
    tx.signatureMember.findMany
      .mockResolvedValueOnce([])
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
        sourceExternalId: "creative-staff:user-jerry",
        linkedUserId: "user-jerry",
        roleGroup: "CREATIVE_STAFF",
        required: true,
      }),
    });
    expect(tx.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        active: true,
        hiddenFromRoster: false,
        staffingType: "FT",
        OR: expect.arrayContaining([
          { title: { contains: "Creative", mode: "insensitive" } },
          { title: { contains: "Digital Media", mode: "insensitive" } },
        ]),
      }),
    }));
  });

  it("is version-checked and leaves an unchanged roster idempotent", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "CREATIVE", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });
    tx.user.findMany.mockResolvedValue([{ id: "user-1", name: "Erik Role", title: "Creative Director" }]);
    tx.signatureMember.findMany
      .mockResolvedValueOnce([{ id: "member-1", linkedUserId: "user-1", required: true, active: true, name: "Erik Role", title: "Creative Director" }])
      .mockResolvedValueOnce([])
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

  it("links an exact uniquely named team staff member to the Creative Staff identity", async () => {
    tx.signatureCollection.findUnique.mockResolvedValue({ id: "collection-1", sportCode: "CREATIVE", season: "2026-27", status: SignatureCollectionStatus.OPEN, collectionVersion: 4, settingsVersion: 2 });
    tx.user.findMany.mockResolvedValue([{ id: "user-1", name: "AJ Harrison", title: "Brand Communications" }]);
    tx.signatureMember.findMany
      .mockResolvedValueOnce([{ id: "creative-member", linkedUserId: "user-1", required: true, active: true, name: "AJ Harrison", title: "Brand Communications" }])
      .mockResolvedValueOnce([{ id: "team-member", normalizedName: "aj harrison", linkedUserId: null }])
      .mockResolvedValueOnce([{ id: "creative-member" }]);
    tx.signatureMember.updateMany.mockResolvedValue({ count: 1 });
    tx.signatureCapture.createMany.mockResolvedValue({ count: 0 });
    tx.signatureCollection.update.mockResolvedValue({ collectionVersion: 5 });

    await expect(syncSignatureCreativeStaff({ actor, collectionId: "collection-1", expectedCollectionVersion: 4 })).resolves.toMatchObject({
      linkedTeamMembers: 1,
      collectionVersion: 5,
      unchanged: false,
    });

    expect(tx.signatureMember.updateMany).toHaveBeenCalledWith({
      where: { id: "team-member", linkedUserId: null },
      data: { linkedUserId: "user-1" },
    });
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
