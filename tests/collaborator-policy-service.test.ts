import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollaboratorPolicyStatus, Role } from "@prisma/client";

const tx = {
  collaboratorPolicy: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  collaboratorAffiliation: { update: vi.fn() },
  collaboratorPolicyGrant: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  collaboratorPolicyRevision: { create: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  },
}));

vi.mock("@/lib/audit", () => ({ createAuditEntryTx: vi.fn() }));

import { createAuditEntryTx } from "@/lib/audit";
import { updateCollaboratorPolicy } from "@/lib/services/collaborator-policies";

const actor = { id: "admin-1", role: Role.ADMIN };

function currentPolicy() {
  return {
    id: "policy-1",
    affiliationId: "affiliation-1",
    status: CollaboratorPolicyStatus.ACTIVE,
    version: 3,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    affiliation: {
      id: "affiliation-1",
      key: "BIG_TEN_NETWORK",
      displayName: "Big Ten Network",
      badgeLabel: "BTN",
      archivedAt: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    grants: [
      { id: "grant-1", policyId: "policy-1", capabilityKey: "GEAR_CATALOG_VIEW", createdAt: new Date() },
      { id: "grant-2", policyId: "policy-1", capabilityKey: "MY_GEAR_VIEW", createdAt: new Date() },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.collaboratorPolicy.findUnique.mockResolvedValue(currentPolicy());
  tx.collaboratorPolicy.updateMany.mockResolvedValue({ count: 1 });
  tx.user.findMany.mockResolvedValue([]);
});

describe("collaborator policy mutations", () => {
  it("rejects stale optimistic versions before writing", async () => {
    await expect(updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 2,
      capabilities: ["GEAR_CATALOG_VIEW"],
    })).rejects.toMatchObject({ status: 409, message: "Policy changed since it was loaded" });

    expect(tx.collaboratorPolicy.updateMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("rejects unknown capability keys and active empty policies", async () => {
    await expect(updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      capabilities: ["UNSHIPPED_POWER"],
    })).rejects.toMatchObject({ status: 400 });

    await expect(updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      capabilities: [],
    })).rejects.toMatchObject({ status: 400, message: "An active affiliation must have at least one capability" });
  });

  it("requires acknowledgement before reducing access", async () => {
    await expect(updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      capabilities: ["GEAR_CATALOG_VIEW"],
    })).rejects.toMatchObject({ status: 409, message: "This policy change requires risk acknowledgement" });

    expect(tx.collaboratorPolicyGrant.deleteMany).not.toHaveBeenCalled();
  });

  it("preserves deliberate badge casing without changing existing acronyms", async () => {
    tx.collaboratorPolicy.findUnique.mockResolvedValue({
      ...currentPolicy(),
      affiliation: {
        ...currentPolicy().affiliation,
        key: "LEARFIELD",
        displayName: "Learfield",
        badgeLabel: "LEARFIELD",
      },
    });

    await updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      badgeLabel: "Learfield",
    });

    expect(tx.collaboratorAffiliation.update).toHaveBeenLastCalledWith({
      where: { id: "affiliation-1" },
      data: { displayName: "Learfield", badgeLabel: "Learfield" },
    });

    tx.collaboratorPolicy.findUnique.mockResolvedValue(currentPolicy());

    await updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      badgeLabel: "BTN",
    });

    expect(tx.collaboratorAffiliation.update).toHaveBeenLastCalledWith({
      where: { id: "affiliation-1" },
      data: { displayName: "Big Ten Network", badgeLabel: "BTN" },
    });
  });

  it("writes one revision, audit, and deduplicated notices atomically", async () => {
    tx.user.findMany.mockResolvedValue([{ id: "collaborator-1" }]);

    await expect(updateCollaboratorPolicy({
      actor,
      policyId: "policy-1",
      expectedVersion: 3,
      capabilities: ["GEAR_CATALOG_VIEW"],
      acknowledgeRisk: true,
    })).resolves.toBe(4);

    expect(tx.collaboratorPolicyRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 4, capabilities: ["GEAR_CATALOG_VIEW"] }),
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "updated",
      before: expect.objectContaining({ version: 3 }),
      after: expect.objectContaining({ version: 4 }),
    }));
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        userId: "collaborator-1",
        dedupeKey: "collaborator_policy:policy-1:4:collaborator-1",
      })],
      skipDuplicates: true,
    });
  });
});
