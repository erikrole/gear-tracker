import { randomUUID } from "node:crypto";
import {
  Prisma,
  SignatureArtifactState,
  SignatureCollectionStatus,
  SignatureMemberGroup,
  SignatureSaveStatus,
  SignatureSnapshotStatus,
  Role,
  ShiftArea,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { withSerializationRetry } from "@/lib/serialization";
import { renderSignatureArtifacts } from "@/lib/signatures/artifacts";
import {
  DEFAULT_SIGNATURE_PEN_SETTINGS,
  SIGNATURE_CREATIVE_STAFF_SPORT_CODE,
  SIGNATURE_MBB_SPORT_CODE,
  normalizeSignatureName,
  penSettingsSchema,
  signatureCreativeStaffCollectionSchema,
  signatureRosterEntrySchema,
  type CaptureSaveRequest,
  type SignaturePenSettings,
  type SignatureRosterEntry,
} from "@/lib/signatures/types";
import {
  buildSignatureArtifactPath,
  deletePrivateSignatureArtifacts,
  uploadPrivateSignatureArtifact,
} from "@/lib/signatures/storage";
import { compareSignatureRosterMembers } from "@/lib/signatures/roster";

const signatureJson = (value: unknown) => value as Prisma.InputJsonValue;

type Actor = { id: string; role: Role };

const CREATIVE_STAFF_SOURCE_PREFIX = "creative-staff:";

function publicArtifact(revision: {
  id: string;
  state: SignatureArtifactState;
  width: number;
  height: number;
  pngHash: string;
  svgHash: string;
  committedAt: Date | null;
}) {
  if (revision.state !== SignatureArtifactState.READY) return null;
  return {
    id: revision.id,
    width: revision.width,
    height: revision.height,
    pngHash: revision.pngHash,
    svgHash: revision.svgHash,
    committedAt: revision.committedAt?.toISOString() ?? null,
  };
}

function collectionCompleteness(
  members: Array<{ active: boolean; required: boolean; capture: { currentRevision: { state: SignatureArtifactState } | null } | null }>,
) {
  const requiredActive = members.filter((member) => member.active && member.required);
  const complete = requiredActive.filter(
    (member) => member.capture?.currentRevision?.state === SignatureArtifactState.READY,
  );
  return {
    complete: complete.length,
    required: requiredActive.length,
    percent: requiredActive.length === 0 ? 100 : Math.round((complete.length / requiredActive.length) * 100),
  };
}

const collectionInclude = {
  snapshots: {
    where: { status: SignatureSnapshotStatus.APPLIED },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { entries: true },
  },
  members: {
    orderBy: { name: "asc" as const },
    include: {
      sourceSnapshot: { select: { entries: true } },
      capture: {
        include: {
          currentRevision: {
            select: {
              id: true,
              state: true,
              width: true,
              height: true,
              pngHash: true,
              svgHash: true,
              committedAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SignatureCollectionInclude;

function visibleSignatureMembers<T extends { roleGroup: SignatureMemberGroup }>(sportCode: string, members: T[]) {
  return sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE
    ? members.filter((member) => member.roleGroup === SignatureMemberGroup.CREATIVE_STAFF)
    : members.filter((member) => member.roleGroup !== SignatureMemberGroup.CREATIVE_STAFF);
}

export async function listSignatureCollections(options: { includeArchived?: boolean } = {}) {
  const collections = await db.signatureCollection.findMany({
    where: options.includeArchived ? undefined : { status: SignatureCollectionStatus.OPEN },
    orderBy: [{ status: "asc" }, { season: "desc" }],
    include: {
      members: { select: { active: true, required: true, roleGroup: true } },
      captures: {
        where: {
          currentRevision: { is: { state: SignatureArtifactState.READY } },
          member: { active: true, required: true },
        },
        select: { id: true, member: { select: { roleGroup: true } } },
      },
    },
  });
  return collections.map((collection) => {
    const members = visibleSignatureMembers(collection.sportCode, collection.members);
    const captures = collection.captures.filter((capture) => collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE
      ? capture.member.roleGroup === SignatureMemberGroup.CREATIVE_STAFF
      : capture.member.roleGroup !== SignatureMemberGroup.CREATIVE_STAFF);
    const required = members.filter((member) => member.active && member.required).length;
    const complete = captures.length;
    return {
      id: collection.id,
      sportCode: collection.sportCode,
      season: collection.season,
      status: collection.status,
      collectionVersion: collection.collectionVersion,
      settingsVersion: collection.settingsVersion,
      activeMemberCount: members.filter((member) => member.active).length,
      completeness: {
        complete,
        required,
        percent: collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE && members.every((member) => !member.active)
          ? 0
          : required === 0 ? 100 : Math.round((complete / required) * 100),
      },
      updatedAt: collection.updatedAt.toISOString(),
    };
  });
}

export async function getSignatureCollection(collectionId: string) {
  const collection = await db.signatureCollection.findUnique({
    where: { id: collectionId },
    include: collectionInclude,
  });
  if (!collection) throw new HttpError(404, "Signature collection not found");
  return serializeSignatureCollection(collection);
}

function serializeSignatureCollection(collection: Prisma.SignatureCollectionGetPayload<{ include: typeof collectionInclude }>) {
  const members = visibleSignatureMembers(collection.sportCode, collection.members);
  const sourceOrderByExternalId = new Map<string, number>();
  const latestSnapshotEntries = signatureRosterEntrySchema.array().safeParse(collection.snapshots[0]?.entries);
  if (latestSnapshotEntries.success) {
    latestSnapshotEntries.data.forEach((entry, index) => sourceOrderByExternalId.set(entry.sourceExternalId, index));
  }
  if (sourceOrderByExternalId.size === 0) {
    for (const member of members) {
      if (!member.sourceSnapshot) continue;
      const snapshotEntries = signatureRosterEntrySchema.array().safeParse(member.sourceSnapshot.entries);
      if (!snapshotEntries.success) continue;
      snapshotEntries.data.forEach((entry, index) => {
        if (!sourceOrderByExternalId.has(entry.sourceExternalId)) sourceOrderByExternalId.set(entry.sourceExternalId, index);
      });
    }
  }

  return {
    id: collection.id,
    sportCode: collection.sportCode,
    season: collection.season,
    status: collection.status,
    collectionVersion: collection.collectionVersion,
    settingsVersion: collection.settingsVersion,
    penSettings: penSettingsSchema.parse(collection.penSettings),
    completeness: collectionCompletenessForSerializedRoster(collection.sportCode, members),
    members: [...members]
      .map((member) => ({
        id: member.id,
        name: member.name,
        jerseyNumber: member.jerseyNumber,
        title: member.title,
        roleGroup: member.roleGroup,
        sourceOrder: sourceOrderByExternalId.get(member.sourceExternalId) ?? null,
        required: member.required,
        active: member.active,
        linkedUserId: member.linkedUserId,
        captureVersion: member.capture?.captureVersion ?? 0,
        settingsVersion: member.capture?.settingsVersion ?? collection.settingsVersion,
        artifact: member.capture?.currentRevision ? publicArtifact(member.capture.currentRevision) : null,
      }))
      .sort(compareSignatureRosterMembers),
  };
}

function collectionCompletenessForSerializedRoster(
  sportCode: string,
  members: Array<{ active: boolean; required: boolean; capture: { currentRevision: { state: SignatureArtifactState } | null } | null }>,
) {
  const completeness = collectionCompleteness(members);
  if (sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE && !members.some((member) => member.active)) {
    completeness.percent = 0;
  }
  return completeness;
}

export async function createSignatureRosterPreview(input: {
  actor: Actor;
  season: string;
  sourceUrl: string;
  sourceHash: string;
  parserVersion: string;
  fetchedAt: Date;
  entries: SignatureRosterEntry[];
}) {
  const { actor, season, sourceUrl, sourceHash, parserVersion, fetchedAt, entries } = input;
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.upsert({
      where: { sportCode_season: { sportCode: SIGNATURE_MBB_SPORT_CODE, season } },
      create: {
        sportCode: SIGNATURE_MBB_SPORT_CODE,
        season,
        penSettings: signatureJson(DEFAULT_SIGNATURE_PEN_SETTINGS),
        createdById: actor.id,
        updatedById: actor.id,
      },
      update: {},
      select: { id: true, collectionVersion: true, status: true },
    });
    if (collection.status === SignatureCollectionStatus.ARCHIVED) {
      throw new HttpError(409, "Archived signature collections are read-only");
    }

    const existing = await tx.signatureRosterSnapshot.findUnique({
      where: { collectionId_sourceHash: { collectionId: collection.id, sourceHash } },
      select: { id: true, createdAt: true, status: true },
    });
    if (existing) {
      return {
        collectionId: collection.id,
        collectionVersion: collection.collectionVersion,
        snapshotId: existing.id,
        createdAt: existing.createdAt.toISOString(),
        candidateCount: entries.length,
        unchanged: true,
        alreadyApplied: existing.status === SignatureSnapshotStatus.APPLIED,
      };
    }

    const snapshot = await tx.signatureRosterSnapshot.create({
      data: {
        collectionId: collection.id,
        status: SignatureSnapshotStatus.PREVIEW,
        sourceKey: "UW_BADGERS_MBB",
        sourceUrl,
        sourceHash,
        parserVersion,
        fetchedAt,
        candidateCount: entries.length,
        entries: signatureJson(entries),
      },
    });
    await createAuditEntryTx(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "SignatureRosterSnapshot",
      entityId: snapshot.id,
      action: "PREVIEW",
      after: {
        collectionId: collection.id,
        sourceHash,
        parserVersion,
        candidateCount: entries.length,
      },
    });
    return {
      collectionId: collection.id,
      collectionVersion: collection.collectionVersion,
      snapshotId: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      candidateCount: entries.length,
      unchanged: false,
      alreadyApplied: false,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applySignatureRosterSnapshot(input: {
  actor: Actor;
  snapshotId: string;
  expectedCollectionVersion: number;
}) {
  const result = await db.$transaction(async (tx) => {
    const snapshot = await tx.signatureRosterSnapshot.findUnique({
      where: { id: input.snapshotId },
      include: { collection: true },
    });
    if (!snapshot) throw new HttpError(404, "Roster snapshot not found");
    if (snapshot.collection.status === SignatureCollectionStatus.ARCHIVED) {
      throw new HttpError(409, "Archived signature collections are read-only");
    }
    if (snapshot.collection.collectionVersion !== input.expectedCollectionVersion) {
      throw new HttpError(409, "Roster changed since this preview was created");
    }

    if (snapshot.status === SignatureSnapshotStatus.APPLIED) {
      const latestApplied = await tx.signatureRosterSnapshot.findFirst({
        where: { collectionId: snapshot.collectionId, status: SignatureSnapshotStatus.APPLIED },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (latestApplied?.id === snapshot.id) {
        const memberCount = await tx.signatureMember.count({ where: { collectionId: snapshot.collectionId } });
        return { collectionId: snapshot.collectionId, collectionVersion: snapshot.collection.collectionVersion, memberCount, unchanged: true };
      }
    }

    const entries = signatureRosterEntrySchema.array().parse(snapshot.entries) as SignatureRosterEntry[];
    if (entries.some((entry) => entry.roleGroup === SignatureMemberGroup.CREATIVE_STAFF)) {
      throw new HttpError(400, "Creative staff must use the standalone Creative staff roster");
    }
    const existing = await tx.signatureMember.findMany({
      where: { collectionId: snapshot.collectionId },
      select: { id: true, sourceExternalId: true, required: true, roleGroup: true },
    });
    const existingBySource = new Map(existing.map((member) => [member.sourceExternalId, member]));

    for (const entry of entries) {
      const existingMember = existingBySource.get(entry.sourceExternalId);
      if (existingMember) {
        await tx.signatureMember.update({
          where: { id: existingMember.id },
          data: {
            sourceSnapshotId: snapshot.id,
            sourceProfileUrl: entry.sourceProfileUrl,
            name: entry.name,
            normalizedName: entry.normalizedName,
            jerseyNumber: entry.jerseyNumber,
            roleGroup: entry.roleGroup as SignatureMemberGroup,
            title: entry.title,
            // Preserve an admin's required-state decision on re-import. A
            // role transition into or out of support staff gets the new
            // group's default only once; unchanged members keep their choice.
            required: existingMember.roleGroup === entry.roleGroup
              ? existingMember.required
              : entry.roleGroup === "SUPPORT_STAFF" || existingMember.roleGroup === "SUPPORT_STAFF"
                ? false
                : existingMember.required,
            active: true,
          },
        });
      } else {
        const member = await tx.signatureMember.create({
          data: {
            collectionId: snapshot.collectionId,
            sourceSnapshotId: snapshot.id,
            sourceExternalId: entry.sourceExternalId,
            sourceProfileUrl: entry.sourceProfileUrl,
            name: entry.name,
            normalizedName: entry.normalizedName,
            jerseyNumber: entry.jerseyNumber,
            roleGroup: entry.roleGroup as SignatureMemberGroup,
            title: entry.title,
            required: entry.roleGroup !== "SUPPORT_STAFF",
          },
        });
        existingBySource.set(entry.sourceExternalId, { id: member.id, sourceExternalId: member.sourceExternalId, required: member.required, roleGroup: member.roleGroup });
      }
    }

    const sourceIds = entries.map((entry) => entry.sourceExternalId);
    if (sourceIds.length > 0) {
      await tx.signatureMember.updateMany({
        where: {
          collectionId: snapshot.collectionId,
          sourceExternalId: { notIn: sourceIds },
        },
        data: { active: false },
      });
    }

    const members = await tx.signatureMember.findMany({
      where: { collectionId: snapshot.collectionId },
      select: { id: true },
    });
    await tx.signatureCapture.createMany({
      data: members.map((member) => ({
        collectionId: snapshot.collectionId,
        memberId: member.id,
        settingsVersion: snapshot.collection.settingsVersion,
      })),
      skipDuplicates: true,
    });

    await tx.signatureRosterSnapshot.update({
      where: { id: snapshot.id },
      data: { status: SignatureSnapshotStatus.APPLIED, appliedAt: new Date(), appliedById: input.actor.id },
    });
    const collection = await tx.signatureCollection.update({
      where: { id: snapshot.collectionId },
      data: { collectionVersion: { increment: 1 }, updatedById: input.actor.id },
      select: { id: true, collectionVersion: true },
    });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureRosterSnapshot",
      entityId: snapshot.id,
      action: "APPLY",
      before: { collectionVersion: input.expectedCollectionVersion, sourceHash: snapshot.sourceHash },
      after: { collectionVersion: collection.collectionVersion, candidateCount: snapshot.candidateCount },
    });
    return { collectionId: collection.id, collectionVersion: collection.collectionVersion, memberCount: members.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result;
}

export async function ensureSignatureCreativeStaffCollection(input: {
  actor: Actor;
  season: string;
}) {
  const { season } = signatureCreativeStaffCollectionSchema.parse({ season: input.season });
  try {
    return await withSerializationRetry(() => db.$transaction(async (tx) => {
      const existing = await tx.signatureCollection.findUnique({
        where: { sportCode_season: { sportCode: SIGNATURE_CREATIVE_STAFF_SPORT_CODE, season } },
        select: { id: true, sportCode: true, season: true, status: true, collectionVersion: true },
      });
      if (existing) return { ...existing, created: false };

      const created = await tx.signatureCollection.create({
        data: {
          sportCode: SIGNATURE_CREATIVE_STAFF_SPORT_CODE,
          season,
          penSettings: signatureJson(DEFAULT_SIGNATURE_PEN_SETTINGS),
          createdById: input.actor.id,
          updatedById: input.actor.id,
        },
        select: { id: true, sportCode: true, season: true, status: true, collectionVersion: true },
      });
      await createAuditEntryTx(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        entityType: "SignatureCollection",
        entityId: created.id,
        action: "CREATE",
        after: { sportCode: created.sportCode, season: created.season, collectionVersion: created.collectionVersion },
      });
      return { ...created, created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.signatureCollection.findUnique({
        where: { sportCode_season: { sportCode: SIGNATURE_CREATIVE_STAFF_SPORT_CODE, season } },
        select: { id: true, sportCode: true, season: true, status: true, collectionVersion: true },
      });
      if (existing) return { ...existing, created: false };
    }
    throw error;
  }
}

export async function syncSignatureCreativeStaff(input: {
  actor: Actor;
  collectionId: string;
  expectedCollectionVersion: number;
}) {
  return withSerializationRetry(() => db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({
      where: { id: input.collectionId },
      select: { id: true, sportCode: true, status: true, collectionVersion: true, settingsVersion: true },
    });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.sportCode !== SIGNATURE_CREATIVE_STAFF_SPORT_CODE) {
      throw new HttpError(409, "Creative staff uses its standalone roster");
    }
    if (collection.status === SignatureCollectionStatus.ARCHIVED) {
      throw new HttpError(409, "Archived signature collections are read-only");
    }
    if (collection.collectionVersion !== input.expectedCollectionVersion) {
      throw new HttpError(409, "Collection changed since this form was opened");
    }

    const users = await tx.user.findMany({
      where: {
        active: true,
        hiddenFromRoster: false,
        staffingType: "FT",
        OR: [
          { primaryArea: { in: [ShiftArea.VIDEO, ShiftArea.PHOTO, ShiftArea.GRAPHICS] } },
          { areaAssignments: { some: { area: { in: [ShiftArea.VIDEO, ShiftArea.PHOTO, ShiftArea.GRAPHICS] } } } },
        ],
      },
      select: { id: true, name: true, title: true },
      orderBy: { name: "asc" },
    });
    const existing = await tx.signatureMember.findMany({
      where: { collectionId: collection.id, roleGroup: SignatureMemberGroup.CREATIVE_STAFF },
      select: { id: true, linkedUserId: true, required: true, active: true, name: true, title: true },
    });
    const existingByUser = new Map(existing.filter((member) => member.linkedUserId).map((member) => [member.linkedUserId as string, member]));
    const activeUserIds = new Set(users.map((user) => user.id));
    let added = 0;
    let reactivated = 0;
    let updated = 0;
    let changed = false;

    for (const user of users) {
      const current = existingByUser.get(user.id);
      if (current) {
        const needsUpdate = !current.active || current.name !== user.name || current.title !== user.title;
        if (needsUpdate) {
          await tx.signatureMember.update({
            where: { id: current.id },
            data: { name: user.name, normalizedName: normalizeSignatureName(user.name), title: user.title, active: true },
          });
          updated += 1;
          if (!current.active) reactivated += 1;
          changed = true;
        }
        continue;
      }

      await tx.signatureMember.create({
        data: {
          collectionId: collection.id,
          sourceExternalId: `${CREATIVE_STAFF_SOURCE_PREFIX}${user.id}`,
          name: user.name,
          normalizedName: normalizeSignatureName(user.name),
          roleGroup: SignatureMemberGroup.CREATIVE_STAFF,
          title: user.title,
          required: true,
          active: true,
          linkedUserId: user.id,
        },
      });
      added += 1;
      changed = true;
    }

    const stale = existing.filter((member) => member.active && (!member.linkedUserId || !activeUserIds.has(member.linkedUserId)));
    if (stale.length > 0) {
      await tx.signatureMember.updateMany({
        where: { id: { in: stale.map((member) => member.id) }, active: true },
        data: { active: false },
      });
      changed = true;
    }

    const members = await tx.signatureMember.findMany({
      where: { collectionId: collection.id },
      select: { id: true },
    });
    await tx.signatureCapture.createMany({
      data: members.map((member) => ({
        collectionId: collection.id,
        memberId: member.id,
        settingsVersion: collection.settingsVersion,
      })),
      skipDuplicates: true,
    });

    const nextCollectionVersion = changed
      ? (await tx.signatureCollection.update({
          where: { id: collection.id },
          data: { collectionVersion: { increment: 1 }, updatedById: input.actor.id },
          select: { collectionVersion: true },
        })).collectionVersion
      : collection.collectionVersion;
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureCollection",
      entityId: collection.id,
      action: "SYNC_CREATIVE_STAFF",
      before: { collectionVersion: input.expectedCollectionVersion, activeMembers: existing.filter((member) => member.active).length },
      after: { collectionVersion: nextCollectionVersion, activeMembers: users.length, added, reactivated, updated, deactivated: stale.length },
    });
    return {
      collectionId: collection.id,
      collectionVersion: nextCollectionVersion,
      activeCount: users.length,
      added,
      reactivated,
      updated,
      deactivated: stale.length,
      unchanged: !changed,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function updateSignaturePenSettings(input: {
  actor: Actor;
  collectionId: string;
  expectedCollectionVersion: number;
  expectedSettingsVersion: number;
  settings: SignaturePenSettings;
}) {
  penSettingsSchema.parse(input.settings);
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({ where: { id: input.collectionId } });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
    if (collection.collectionVersion !== input.expectedCollectionVersion || collection.settingsVersion !== input.expectedSettingsVersion) {
      throw new HttpError(409, "Signature settings changed since this form was opened");
    }
    if (collection.firstCaptureAt) {
      throw new HttpError(409, "Changing pen settings requires an explicit collection reset after the first capture");
    }
    const updated = await tx.signatureCollection.update({
      where: { id: input.collectionId },
      data: {
        penSettings: signatureJson(input.settings),
        settingsVersion: { increment: 1 },
        collectionVersion: { increment: 1 },
        updatedById: input.actor.id,
      },
      select: { collectionVersion: true, settingsVersion: true },
    });
    await tx.signatureCapture.updateMany({
      where: { collectionId: input.collectionId },
      data: { settingsVersion: updated.settingsVersion },
    });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureCollection",
      entityId: input.collectionId,
      action: "UPDATE_PEN_SETTINGS",
      before: { collectionVersion: input.expectedCollectionVersion, settingsVersion: input.expectedSettingsVersion },
      after: { collectionVersion: updated.collectionVersion, settingsVersion: updated.settingsVersion, settings: input.settings },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateSignatureMemberRequired(input: {
  actor: Actor;
  collectionId: string;
  memberId: string;
  required: boolean;
  expectedCollectionVersion: number;
}) {
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({ where: { id: input.collectionId }, select: { collectionVersion: true, status: true } });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
    if (collection.collectionVersion !== input.expectedCollectionVersion) throw new HttpError(409, "Collection changed since this form was opened");
    const member = await tx.signatureMember.findFirst({ where: { id: input.memberId, collectionId: input.collectionId }, select: { id: true, required: true } });
    if (!member) throw new HttpError(404, "Signature member not found");
    await tx.signatureMember.update({ where: { id: member.id }, data: { required: input.required } });
    const updated = await tx.signatureCollection.update({ where: { id: input.collectionId }, data: { collectionVersion: { increment: 1 }, updatedById: input.actor.id }, select: { collectionVersion: true } });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureMember",
      entityId: member.id,
      action: "UPDATE_REQUIRED",
      before: { required: member.required, collectionVersion: input.expectedCollectionVersion },
      after: { required: input.required, collectionVersion: updated.collectionVersion },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function archiveSignatureCollection(input: { actor: Actor; collectionId: string; expectedCollectionVersion: number }) {
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({ where: { id: input.collectionId }, select: { id: true, status: true, collectionVersion: true } });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.status === SignatureCollectionStatus.ARCHIVED) return collection;
    if (collection.collectionVersion !== input.expectedCollectionVersion) throw new HttpError(409, "Collection changed since this form was opened");
    const updated = await tx.signatureCollection.update({
      where: { id: collection.id },
      data: { status: SignatureCollectionStatus.ARCHIVED, archivedAt: new Date(), archivedById: input.actor.id, collectionVersion: { increment: 1 }, updatedById: input.actor.id },
      select: { id: true, status: true, collectionVersion: true },
    });
    await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCollection", entityId: collection.id, action: "ARCHIVE", before: { status: collection.status, collectionVersion: collection.collectionVersion }, after: { status: updated.status, collectionVersion: updated.collectionVersion } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function restoreSignatureCollection(input: { actor: Actor; collectionId: string; expectedCollectionVersion: number }) {
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({ where: { id: input.collectionId }, select: { id: true, status: true, collectionVersion: true } });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.status === SignatureCollectionStatus.OPEN) return collection;
    if (collection.collectionVersion !== input.expectedCollectionVersion) throw new HttpError(409, "Collection changed since this form was opened");
    const updated = await tx.signatureCollection.update({
      where: { id: collection.id },
      data: { status: SignatureCollectionStatus.OPEN, archivedAt: null, archivedById: null, collectionVersion: { increment: 1 }, updatedById: input.actor.id },
      select: { id: true, status: true, collectionVersion: true },
    });
    await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCollection", entityId: collection.id, action: "RESTORE", before: { status: collection.status, collectionVersion: collection.collectionVersion }, after: { status: updated.status, collectionVersion: updated.collectionVersion } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function resetSignatureCollection(input: { actor: Actor; collectionId: string; expectedCollectionVersion: number }) {
  const result = await db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({ where: { id: input.collectionId }, select: { id: true, status: true, collectionVersion: true } });
    if (!collection) throw new HttpError(404, "Signature collection not found");
    if (collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
    if (collection.collectionVersion !== input.expectedCollectionVersion) throw new HttpError(409, "Collection changed since this form was opened");
    const captures = await tx.signatureCapture.findMany({ where: { collectionId: input.collectionId }, select: { id: true, currentRevisionId: true, captureVersion: true } });
    const revisions = captures.map((capture) => capture.currentRevisionId).filter((value): value is string => Boolean(value));
    if (captures.length > 0) {
      // Increment every capture, including currently blank members, so an
      // in-flight save cannot commit after an explicit collection reset.
      await tx.signatureCapture.updateMany({ where: { id: { in: captures.map((capture) => capture.id) } }, data: { currentRevisionId: null, captureVersion: { increment: 1 } } });
      await tx.signatureArtifactRevision.updateMany({ where: { id: { in: revisions } }, data: { state: SignatureArtifactState.PENDING_DELETE, replacedAt: new Date() } });
    }
    const updated = await tx.signatureCollection.update({ where: { id: input.collectionId }, data: { firstCaptureAt: null, collectionVersion: { increment: 1 }, updatedById: input.actor.id }, select: { collectionVersion: true } });
    await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCollection", entityId: input.collectionId, action: "RESET", before: { collectionVersion: input.expectedCollectionVersion, captures: captures.length }, after: { collectionVersion: updated.collectionVersion, captures: 0 } });
    const artifactRows = revisions.length > 0 ? await tx.signatureArtifactRevision.findMany({ where: { id: { in: revisions } }, select: { id: true, pngPath: true, svgPath: true } }) : [];
    return { collectionVersion: updated.collectionVersion, revisions: artifactRows, captureCount: captures.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await cleanupSignatureRevisions(result.revisions);
  return { collectionVersion: result.collectionVersion, resetCount: result.captureCount };
}

export async function removeSignatureCapture(input: {
  actor: Actor;
  collectionId: string;
  memberId: string;
  expectedCaptureVersion: number;
}) {
  const result = await db.$transaction(async (tx) => {
    const capture = await tx.signatureCapture.findFirst({
      where: { collectionId: input.collectionId, memberId: input.memberId },
      include: { currentRevision: true, collection: true },
    });
    if (!capture) throw new HttpError(404, "Signature member is not ready for capture");
    if (capture.collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
    if (capture.captureVersion !== input.expectedCaptureVersion) throw new HttpError(409, "This signature changed elsewhere; reload before removing it");
    if (!capture.currentRevision) return { revision: null, captureVersion: capture.captureVersion };
    const revision = capture.currentRevision;
    await tx.signatureCapture.update({ where: { id: capture.id }, data: { currentRevisionId: null, captureVersion: { increment: 1 } } });
    await tx.signatureArtifactRevision.update({ where: { id: revision.id }, data: { state: SignatureArtifactState.PENDING_DELETE, replacedAt: new Date() } });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureCapture",
      entityId: capture.id,
      action: "REMOVE",
      before: { captureVersion: capture.captureVersion, revisionId: revision.id, pngHash: revision.pngHash, svgHash: revision.svgHash },
      after: { captureVersion: capture.captureVersion + 1, revisionId: null },
    });
    return { revision: { id: revision.id, pngPath: revision.pngPath, svgPath: revision.svgPath }, captureVersion: capture.captureVersion + 1 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result.revision) await cleanupSignatureRevisions([result.revision]);
  return { removed: Boolean(result.revision), captureVersion: result.captureVersion };
}

async function markSaveFailed(revisionId: string, operationId: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Signature save failed";
  await db.$transaction(async (tx) => {
    await tx.signatureArtifactRevision.updateMany({ where: { id: revisionId, state: SignatureArtifactState.PENDING_DELETE }, data: { state: SignatureArtifactState.PENDING_DELETE, errorMessage: message } });
    await tx.signatureSaveOperation.updateMany({ where: { id: operationId, status: { not: SignatureSaveStatus.COMMITTED } }, data: { status: SignatureSaveStatus.FAILED, errorMessage: message } });
  });
}

async function cleanupSignatureRevisions(revisions: Array<{ id: string; pngPath: string; svgPath: string }>) {
  for (const revision of revisions) {
    try {
      await deletePrivateSignatureArtifacts([revision.pngPath, revision.svgPath]);
      await db.signatureArtifactRevision.updateMany({ where: { id: revision.id, state: SignatureArtifactState.PENDING_DELETE }, data: { state: SignatureArtifactState.DELETED, deletedAt: new Date() } });
    } catch {
      // Pending-delete is deliberately durable and retryable. A later cleanup
      // pass can safely attempt the same paths again.
    }
  }
}

export async function saveSignatureCapture(input: { actor: Actor; collectionId: string; memberId: string; request: CaptureSaveRequest }) {
  const existingOperation = await db.signatureSaveOperation.findUnique({ where: { requestId: input.request.requestId }, include: { revision: true, capture: { include: { currentRevision: true } } } });
  if (
    existingOperation &&
    (existingOperation.collectionId !== input.collectionId ||
      existingOperation.memberId !== input.memberId ||
      existingOperation.actorUserId !== input.actor.id ||
      existingOperation.expectedCaptureVersion !== input.request.expectedCaptureVersion ||
      existingOperation.settingsVersion !== input.request.settingsVersion)
  ) {
    throw new HttpError(409, "This save request ID was already used for another signature");
  }
  if (existingOperation?.status === SignatureSaveStatus.COMMITTED && existingOperation.revision) {
    return { status: "committed" as const, captureVersion: existingOperation.capture.captureVersion, revision: publicArtifact(existingOperation.revision) };
  }
  if (existingOperation) throw new HttpError(409, "This save request is already being processed or failed; create a new request to retry");

  const target = await db.signatureCapture.findFirst({ where: { collectionId: input.collectionId, memberId: input.memberId }, include: { collection: true, member: true, currentRevision: true } });
  if (!target) throw new HttpError(404, "Signature member is not ready for capture");
  if (!target.member.active) throw new HttpError(409, "This roster member is inactive and cannot receive a new signature");
  if (target.collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
  if (target.captureVersion !== input.request.expectedCaptureVersion) throw new HttpError(409, "This signature changed elsewhere; keep the local draft and reload");
  if (target.collection.settingsVersion !== input.request.settingsVersion) throw new HttpError(409, "Pen settings changed; reload the capture surface");
  const settings = penSettingsSchema.parse(target.collection.penSettings);
  let artifacts: Awaited<ReturnType<typeof renderSignatureArtifacts>>;
  try {
    artifacts = await renderSignatureArtifacts(input.request.strokes, settings);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Signature")) {
      throw new HttpError(400, error.message);
    }
    throw new HttpError(503, "Signature rendering is temporarily unavailable");
  }
  const revisionId = randomUUID();
  const pngPath = buildSignatureArtifactPath(input.collectionId, input.memberId, revisionId, "png");
  const svgPath = buildSignatureArtifactPath(input.collectionId, input.memberId, revisionId, "svg");

  let operationId: string;
  try {
    const prepared = await withSerializationRetry(() => db.$transaction(async (tx) => {
      const current = await tx.signatureCapture.findUnique({ where: { id: target.id }, select: { captureVersion: true, collectionId: true, memberId: true, settingsVersion: true } });
      if (!current || current.collectionId !== input.collectionId || current.memberId !== input.memberId || current.captureVersion !== input.request.expectedCaptureVersion || current.settingsVersion !== input.request.settingsVersion) throw new HttpError(409, "This signature changed elsewhere; keep the local draft and reload");
      const latest = await tx.signatureArtifactRevision.findFirst({ where: { captureId: target.id }, orderBy: { revision: "desc" }, select: { revision: true } });
      const revision = await tx.signatureArtifactRevision.create({ data: { id: revisionId, captureId: target.id, revision: (latest?.revision ?? 0) + 1, state: SignatureArtifactState.PENDING_DELETE, pngPath, svgPath, pngHash: artifacts.pngHash, svgHash: artifacts.svgHash, width: artifacts.width, height: artifacts.height, cropBounds: signatureJson(artifacts.cropBounds) } });
      const operation = await tx.signatureSaveOperation.create({ data: { requestId: input.request.requestId, collectionId: input.collectionId, memberId: input.memberId, captureId: target.id, expectedCaptureVersion: input.request.expectedCaptureVersion, settingsVersion: input.request.settingsVersion, status: SignatureSaveStatus.UPLOADING, revisionId: revision.id, actorUserId: input.actor.id } });
      return { operationId: operation.id, revisionId: revision.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    operationId = prepared.operationId;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "Another save is already processing this signature");
    throw error;
  }

  try {
    await uploadPrivateSignatureArtifact({ path: pngPath, body: artifacts.png, contentType: "image/png" });
    await uploadPrivateSignatureArtifact({ path: svgPath, body: Buffer.from(artifacts.svg, "utf8"), contentType: "image/svg+xml" });
    await db.signatureSaveOperation.update({
      where: { id: operationId },
      data: { status: SignatureSaveStatus.FINALIZING },
    });
  } catch (error) {
    await markSaveFailed(revisionId, operationId, error);
    try { await deletePrivateSignatureArtifacts([pngPath, svgPath]); } catch { /* durable pending-delete retry owns recovery */ }
    throw new HttpError(503, "Signature files could not be stored; the existing signature was kept");
  }

  let finalized: Awaited<ReturnType<typeof finalizeSignatureSave>>;
  try {
    finalized = await withSerializationRetry(
      () => finalizeSignatureSave({
        actor: input.actor,
        collectionId: input.collectionId,
        captureId: target.id,
        operationId,
        revisionId,
        expectedCaptureVersion: input.request.expectedCaptureVersion,
        settingsVersion: input.request.settingsVersion,
      }),
    );
  } catch (error) {
    await markSaveFailed(revisionId, operationId, error);
    throw error;
  }

  if (finalized.oldRevisionId) {
    const old = await db.signatureArtifactRevision.findUnique({ where: { id: finalized.oldRevisionId }, select: { id: true, pngPath: true, svgPath: true } });
    if (old) await cleanupSignatureRevisions([old]);
  }
  return { status: "committed" as const, captureVersion: finalized.captureVersion, revision: publicArtifact(finalized.revision) };
}

async function finalizeSignatureSave(input: {
  actor: Actor;
  collectionId: string;
  captureId: string;
  operationId: string;
  revisionId: string;
  expectedCaptureVersion: number;
  settingsVersion: number;
}) {
  return db.$transaction(async (tx) => {
      const current = await tx.signatureCapture.findUnique({ where: { id: input.captureId }, include: { currentRevision: true, collection: true, member: true } });
      if (!current || !current.member.active || current.captureVersion !== input.expectedCaptureVersion || current.settingsVersion !== input.settingsVersion || current.collection.status === SignatureCollectionStatus.ARCHIVED) {
        await tx.signatureArtifactRevision.update({ where: { id: input.revisionId }, data: { state: SignatureArtifactState.PENDING_DELETE, errorMessage: "Stale capture during finalization" } });
        await tx.signatureSaveOperation.update({ where: { id: input.operationId }, data: { status: SignatureSaveStatus.FAILED, errorMessage: "Stale capture during finalization" } });
        throw new HttpError(409, "This signature changed while it was saving; the local draft was preserved");
      }
      if (current.currentRevisionId) {
        await tx.signatureArtifactRevision.update({ where: { id: current.currentRevisionId }, data: { state: SignatureArtifactState.PENDING_DELETE, replacedAt: new Date() } });
      }
      const now = new Date();
      const revision = await tx.signatureArtifactRevision.update({ where: { id: input.revisionId }, data: { state: SignatureArtifactState.READY, committedAt: now } });
      const capture = await tx.signatureCapture.update({ where: { id: input.captureId }, data: { currentRevisionId: revision.id, captureVersion: { increment: 1 }, capturedAt: now, capturedById: input.actor.id }, select: { captureVersion: true } });
      await tx.signatureCollection.updateMany({ where: { id: input.collectionId, firstCaptureAt: null }, data: { firstCaptureAt: now, updatedById: input.actor.id } });
      await tx.signatureSaveOperation.update({ where: { id: input.operationId }, data: { status: SignatureSaveStatus.COMMITTED, committedAt: now } });
      await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCapture", entityId: input.captureId, action: "SAVE", before: { captureVersion: input.expectedCaptureVersion, priorRevisionId: current.currentRevisionId, priorPngHash: current.currentRevision?.pngHash ?? null, priorSvgHash: current.currentRevision?.svgHash ?? null }, after: { captureVersion: capture.captureVersion, revisionId: revision.id, pngHash: revision.pngHash, svgHash: revision.svgHash, width: revision.width, height: revision.height } });
      return { captureVersion: capture.captureVersion, revision, oldRevisionId: current.currentRevisionId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getReadySignatureArtifact(revisionId: string, kind: "png" | "svg") {
  const revision = await db.signatureArtifactRevision.findUnique({
    where: { id: revisionId },
    include: { capture: { include: { member: true } } },
  });
  if (!revision || revision.state !== SignatureArtifactState.READY || revision.capture.currentRevisionId !== revision.id) {
    throw new HttpError(404, "Signature artifact not found");
  }
  const safeName = revision.capture.member.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "signature";
  return {
    path: kind === "png" ? revision.pngPath : revision.svgPath,
    contentType: kind === "png" ? "image/png" : "image/svg+xml",
    filename: `${safeName}-${revision.capture.member.id}.${kind}`,
  };
}

export async function cleanupPendingSignatureArtifacts(limit = 50) {
  const revisions = await db.signatureArtifactRevision.findMany({ where: { state: SignatureArtifactState.PENDING_DELETE }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true, pngPath: true, svgPath: true } });
  let deleted = 0;
  for (const revision of revisions) {
    try {
      await deletePrivateSignatureArtifacts([revision.pngPath, revision.svgPath]);
      await db.signatureArtifactRevision.updateMany({ where: { id: revision.id, state: SignatureArtifactState.PENDING_DELETE }, data: { state: SignatureArtifactState.DELETED, deletedAt: new Date() } });
      deleted++;
    } catch {
      // Leave pending rows durable for the next retry.
    }
  }
  return { attempted: revisions.length, deleted };
}
