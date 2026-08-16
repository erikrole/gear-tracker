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
  SIGNATURE_AD_HOC_SPORT_CODE,
  SIGNATURE_CREATIVE_STAFF_SPORT_CODE,
  SIGNATURE_MBB_SPORT_CODE,
  getSignatureRosterSourceConfig,
  normalizeSignatureName,
  penSettingsSchema,
  signatureAdHocMemberSchema,
  signatureCreativeStaffCollectionSchema,
  signatureRosterEntrySchema,
  type CaptureSaveRequest,
  type SignatureImportedSportCode,
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
const CREATIVE_STAFF_TITLE_MARKERS = ["Creative", "Digital Media"] as const;
const creativeStaffTitleFilters = CREATIVE_STAFF_TITLE_MARKERS.map((marker) => ({
  title: { contains: marker, mode: "insensitive" as const },
}));

const artifactRevisionSelect = {
  id: true,
  revision: true,
  state: true,
  width: true,
  height: true,
  pngHash: true,
  svgHash: true,
  pngPath: true,
  svgPath: true,
  committedAt: true,
  replacedAt: true,
} satisfies Prisma.SignatureArtifactRevisionSelect;

function publicArtifact(revision: {
  id: string;
  revision: number;
  state: SignatureArtifactState;
  width: number;
  height: number;
  pngHash: string;
  svgHash: string;
  committedAt: Date | null;
  replacedAt: Date | null;
}) {
  if (revision.state !== SignatureArtifactState.READY) return null;
  return {
    id: revision.id,
    revision: revision.revision,
    width: revision.width,
    height: revision.height,
    pngHash: revision.pngHash,
    svgHash: revision.svgHash,
    committedAt: revision.committedAt?.toISOString() ?? null,
    replacedAt: revision.replacedAt?.toISOString() ?? null,
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
            select: artifactRevisionSelect,
          },
          revisions: {
            where: { state: SignatureArtifactState.READY },
            orderBy: { revision: "desc" as const },
            select: artifactRevisionSelect,
          },
        },
      },
    },
  },
} satisfies Prisma.SignatureCollectionInclude;

const canonicalCaptureInclude = {
  collection: {
    select: { id: true, sportCode: true, season: true, status: true, settingsVersion: true, penSettings: true },
  },
  member: { select: { id: true, active: true, linkedUserId: true } },
  currentRevision: { select: artifactRevisionSelect },
  revisions: {
    where: { state: SignatureArtifactState.READY },
    orderBy: { revision: "desc" as const },
    select: artifactRevisionSelect,
  },
} satisfies Prisma.SignatureCaptureInclude;

type CanonicalSignatureCapture = Prisma.SignatureCaptureGetPayload<{ include: typeof canonicalCaptureInclude }>;

async function resolveSignatureCaptureTarget(collectionId: string, memberId: string) {
  const requested = await db.signatureCapture.findFirst({
    where: { collectionId, memberId },
    include: canonicalCaptureInclude,
  });
  if (!requested) throw new HttpError(404, "Signature member is not ready for capture");
  if (!requested.member.active) throw new HttpError(409, "This roster member is inactive and cannot receive a new signature");
  if (requested.collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
  if (!requested.member.linkedUserId || requested.collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE) {
    return requested;
  }
  const canonical = await db.signatureCapture.findFirst({
    where: {
      collection: {
        sportCode: SIGNATURE_CREATIVE_STAFF_SPORT_CODE,
        season: requested.collection.season,
      },
      member: { active: true, linkedUserId: requested.member.linkedUserId },
    },
    include: canonicalCaptureInclude,
  });
  return canonical ?? requested;
}

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
  const linkedUserIds = [...new Set(collection.members.map((member) => member.linkedUserId).filter((id): id is string => Boolean(id)))];
  const canonicalCaptures = linkedUserIds.length === 0 ? [] : await db.signatureCapture.findMany({
    where: {
      collection: { sportCode: SIGNATURE_CREATIVE_STAFF_SPORT_CODE, season: collection.season },
      member: { active: true, linkedUserId: { in: linkedUserIds } },
    },
    include: canonicalCaptureInclude,
  });
  const canonicalByUserId = new Map(canonicalCaptures
    .filter((capture) => capture.member.linkedUserId)
    .map((capture) => [capture.member.linkedUserId as string, capture]));
  return serializeSignatureCollection(collection, canonicalByUserId);
}

function serializeSignatureCollection(
  collection: Prisma.SignatureCollectionGetPayload<{ include: typeof collectionInclude }>,
  canonicalByUserId: Map<string, CanonicalSignatureCapture>,
) {
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

  const serializedMembers = [...members]
    .map((member) => {
      const canonicalCapture = member.linkedUserId ? canonicalByUserId.get(member.linkedUserId) : undefined;
      const capture = canonicalCapture ?? member.capture;
      const captureSettings = canonicalCapture
        ? penSettingsSchema.parse(canonicalCapture.collection.penSettings)
        : penSettingsSchema.parse(collection.penSettings);
      return {
        id: member.id,
        name: member.name,
        jerseyNumber: member.jerseyNumber,
        title: member.title,
        roleGroup: member.roleGroup,
        sourceOrder: sourceOrderByExternalId.get(member.sourceExternalId) ?? null,
        required: member.required,
        active: member.active,
        linkedUserId: member.linkedUserId,
        captureVersion: capture?.captureVersion ?? 0,
        settingsVersion: capture?.settingsVersion ?? collection.settingsVersion,
        captureSettings,
        artifact: capture?.currentRevision ? publicArtifact(capture.currentRevision) : null,
        revisions: capture?.revisions.map((revision) => publicArtifact(revision)).filter((revision) => revision !== null) ?? [],
      };
    })
    .sort(compareSignatureRosterMembers);
  const requiredActive = serializedMembers.filter((member) => member.active && member.required);
  const complete = requiredActive.filter((member) => member.artifact).length;

  return {
    id: collection.id,
    sportCode: collection.sportCode,
    season: collection.season,
    status: collection.status,
    collectionVersion: collection.collectionVersion,
    settingsVersion: collection.settingsVersion,
    penSettings: penSettingsSchema.parse(collection.penSettings),
    completeness: {
      complete,
      required: requiredActive.length,
      percent: collection.sportCode === SIGNATURE_CREATIVE_STAFF_SPORT_CODE && !serializedMembers.some((member) => member.active)
        ? 0
        : requiredActive.length === 0 ? 100 : Math.round((complete / requiredActive.length) * 100),
    },
    members: serializedMembers,
  };
}

export async function createSignatureRosterPreview(input: {
  actor: Actor;
  sportCode?: SignatureImportedSportCode;
  season: string;
  sourceUrl: string;
  sourceHash: string;
  parserVersion: string;
  fetchedAt: Date;
  entries: SignatureRosterEntry[];
}) {
  const {
    actor,
    sportCode = SIGNATURE_MBB_SPORT_CODE,
    season,
    sourceUrl,
    sourceHash,
    parserVersion,
    fetchedAt,
    entries,
  } = input;
  const source = getSignatureRosterSourceConfig(sportCode);
  return db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.upsert({
      where: { sportCode_season: { sportCode, season } },
      create: {
        sportCode,
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
        sourceKey: source.sourceKey,
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
            // Players always require a signature. Preserve an admin's
            // readiness decision for unchanged non-player groups.
            required: entry.roleGroup === SignatureMemberGroup.PLAYER
              ? true
              : existingMember.roleGroup === entry.roleGroup
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

export async function createAdHocSignatureMember(input: {
  actor: Actor;
  season: string;
  name: string;
  category: string;
}) {
  const parsed = signatureAdHocMemberSchema.parse(input);
  return withSerializationRetry(() => db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.upsert({
      where: { sportCode_season: { sportCode: SIGNATURE_AD_HOC_SPORT_CODE, season: parsed.season } },
      create: {
        sportCode: SIGNATURE_AD_HOC_SPORT_CODE,
        season: parsed.season,
        penSettings: signatureJson(DEFAULT_SIGNATURE_PEN_SETTINGS),
        createdById: input.actor.id,
        updatedById: input.actor.id,
      },
      update: {},
      select: { id: true, status: true, collectionVersion: true, settingsVersion: true },
    });
    if (collection.status === SignatureCollectionStatus.ARCHIVED) {
      throw new HttpError(409, "The ad-hoc signature roster for this season is archived");
    }

    const member = await tx.signatureMember.create({
      data: {
        collectionId: collection.id,
        sourceExternalId: `manual:${randomUUID()}`,
        name: parsed.name,
        normalizedName: normalizeSignatureName(parsed.name),
        roleGroup: SignatureMemberGroup.SUPPORT_STAFF,
        title: parsed.category,
        required: true,
        active: true,
      },
      select: { id: true, name: true, title: true },
    });
    await tx.signatureCapture.create({
      data: {
        collectionId: collection.id,
        memberId: member.id,
        settingsVersion: collection.settingsVersion,
      },
    });
    const updated = await tx.signatureCollection.update({
      where: { id: collection.id },
      data: { collectionVersion: { increment: 1 }, updatedById: input.actor.id },
      select: { collectionVersion: true },
    });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureMember",
      entityId: member.id,
      action: "CREATE_AD_HOC",
      after: {
        collectionId: collection.id,
        collectionVersion: updated.collectionVersion,
        name: member.name,
        category: member.title,
      },
    });
    return {
      collectionId: collection.id,
      collectionVersion: updated.collectionVersion,
      memberId: member.id,
      captureVersion: 0,
      settingsVersion: collection.settingsVersion,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function syncSignatureCreativeStaff(input: {
  actor: Actor;
  collectionId: string;
  expectedCollectionVersion: number;
}) {
  return withSerializationRetry(() => db.$transaction(async (tx) => {
    const collection = await tx.signatureCollection.findUnique({
      where: { id: input.collectionId },
      select: { id: true, sportCode: true, season: true, status: true, collectionVersion: true, settingsVersion: true },
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
          ...creativeStaffTitleFilters,
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
    const usersByNormalizedName = new Map<string, Array<(typeof users)[number]>>();
    for (const user of users) {
      const normalizedName = normalizeSignatureName(user.name);
      usersByNormalizedName.set(normalizedName, [...(usersByNormalizedName.get(normalizedName) ?? []), user]);
    }
    const uniquelyNamedUsers = new Map([...usersByNormalizedName.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([normalizedName, matches]) => [normalizedName, matches[0]]));
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

    const teamMembers = uniquelyNamedUsers.size === 0 ? [] : await tx.signatureMember.findMany({
      where: {
        active: true,
        roleGroup: { not: SignatureMemberGroup.PLAYER },
        normalizedName: { in: [...uniquelyNamedUsers.keys()] },
        collection: {
          season: collection.season,
          sportCode: { notIn: [SIGNATURE_CREATIVE_STAFF_SPORT_CODE, SIGNATURE_AD_HOC_SPORT_CODE] },
        },
      },
      select: { id: true, normalizedName: true, linkedUserId: true },
    });
    let linkedTeamMembers = 0;
    for (const member of teamMembers) {
      const matchedUser = uniquelyNamedUsers.get(member.normalizedName);
      if (!matchedUser || member.linkedUserId === matchedUser.id || member.linkedUserId) continue;
      const linked = await tx.signatureMember.updateMany({
        where: { id: member.id, linkedUserId: null },
        data: { linkedUserId: matchedUser.id },
      });
      if (linked.count > 0) {
        linkedTeamMembers += linked.count;
        changed = true;
      }
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
    if (changed) {
      await createAuditEntryTx(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        entityType: "SignatureCollection",
        entityId: collection.id,
        action: "SYNC_CREATIVE_STAFF",
        before: { collectionVersion: input.expectedCollectionVersion, activeMembers: existing.filter((member) => member.active).length },
        after: { collectionVersion: nextCollectionVersion, activeMembers: users.length, added, reactivated, updated, deactivated: stale.length, linkedTeamMembers },
      });
    }
    return {
      collectionId: collection.id,
      collectionVersion: nextCollectionVersion,
      activeCount: users.length,
      added,
      reactivated,
      updated,
      deactivated: stale.length,
      linkedTeamMembers,
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
    const member = await tx.signatureMember.findFirst({ where: { id: input.memberId, collectionId: input.collectionId }, select: { id: true, required: true, roleGroup: true } });
    if (!member) throw new HttpError(404, "Signature member not found");
    if (member.roleGroup === SignatureMemberGroup.PLAYER && !input.required) {
      throw new HttpError(400, "Players always require a signature");
    }
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
    const captures = await tx.signatureCapture.findMany({
      where: { collectionId: input.collectionId },
      select: {
        id: true,
        currentRevisionId: true,
        captureVersion: true,
        revisions: {
          where: { state: SignatureArtifactState.READY },
          select: { id: true, pngPath: true, svgPath: true },
        },
      },
    });
    const revisions = captures.flatMap((capture) => capture.revisions);
    if (captures.length > 0) {
      // Increment every capture, including currently blank members, so an
      // in-flight save cannot commit after an explicit collection reset.
      await tx.signatureCapture.updateMany({ where: { id: { in: captures.map((capture) => capture.id) } }, data: { currentRevisionId: null, captureVersion: { increment: 1 } } });
    }
    if (revisions.length > 0) {
      await tx.signatureArtifactRevision.updateMany({ where: { id: { in: revisions.map((revision) => revision.id) } }, data: { state: SignatureArtifactState.PENDING_DELETE, replacedAt: new Date() } });
    }
    const updated = await tx.signatureCollection.update({ where: { id: input.collectionId }, data: { firstCaptureAt: null, collectionVersion: { increment: 1 }, updatedById: input.actor.id }, select: { collectionVersion: true } });
    await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCollection", entityId: input.collectionId, action: "RESET", before: { collectionVersion: input.expectedCollectionVersion, captures: captures.length }, after: { collectionVersion: updated.collectionVersion, captures: 0 } });
    return { collectionVersion: updated.collectionVersion, revisions, captureCount: captures.length };
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
  const target = await resolveSignatureCaptureTarget(input.collectionId, input.memberId);
  const result = await db.$transaction(async (tx) => {
    const capture = await tx.signatureCapture.findUnique({
      where: { id: target.id },
      include: {
        currentRevision: true,
        collection: true,
        revisions: {
          where: { state: SignatureArtifactState.READY },
          select: { id: true, pngPath: true, svgPath: true },
        },
      },
    });
    if (!capture) throw new HttpError(404, "Signature member is not ready for capture");
    if (capture.collection.status === SignatureCollectionStatus.ARCHIVED) throw new HttpError(409, "Archived signature collections are read-only");
    if (capture.captureVersion !== input.expectedCaptureVersion) throw new HttpError(409, "This signature changed elsewhere; reload before removing it");
    if (!capture.currentRevision) return { revisions: [], captureVersion: capture.captureVersion };
    const revision = capture.currentRevision;
    await tx.signatureCapture.update({ where: { id: capture.id }, data: { currentRevisionId: null, captureVersion: { increment: 1 } } });
    await tx.signatureArtifactRevision.updateMany({ where: { id: { in: capture.revisions.map((item) => item.id) } }, data: { state: SignatureArtifactState.PENDING_DELETE, replacedAt: new Date() } });
    await createAuditEntryTx(tx, {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      entityType: "SignatureCapture",
      entityId: capture.id,
      action: "REMOVE",
      before: { captureVersion: capture.captureVersion, revisionId: revision.id, pngHash: revision.pngHash, svgHash: revision.svgHash },
      after: { captureVersion: capture.captureVersion + 1, revisionId: null },
    });
    return { revisions: capture.revisions, captureVersion: capture.captureVersion + 1 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (result.revisions.length > 0) await cleanupSignatureRevisions(result.revisions);
  return { removed: result.revisions.length > 0, captureVersion: result.captureVersion };
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
  const target = await resolveSignatureCaptureTarget(input.collectionId, input.memberId);
  const existingOperation = await db.signatureSaveOperation.findUnique({ where: { requestId: input.request.requestId }, include: { revision: true, capture: { include: { currentRevision: true } } } });
  if (
    existingOperation &&
    (existingOperation.collectionId !== target.collectionId ||
      existingOperation.memberId !== target.memberId ||
      existingOperation.actorUserId !== input.actor.id ||
      existingOperation.expectedCaptureVersion !== input.request.expectedCaptureVersion ||
      existingOperation.settingsVersion !== input.request.settingsVersion)
  ) {
    throw new HttpError(409, "This save request ID was already used for another signature");
  }
  if (existingOperation?.status === SignatureSaveStatus.COMMITTED && existingOperation.revision) {
    return { status: "committed" as const, captureVersion: existingOperation.capture.captureVersion, revision: publicArtifact(existingOperation.revision) };
  }
  if (existingOperation?.status === SignatureSaveStatus.FAILED) {
    throw new HttpError(409, "This save request failed; try saving again");
  }
  if (existingOperation) {
    throw new HttpError(425, "This signature is still saving; try again shortly");
  }

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
  const pngPath = buildSignatureArtifactPath(target.collectionId, target.memberId, revisionId, "png");
  const svgPath = buildSignatureArtifactPath(target.collectionId, target.memberId, revisionId, "svg");

  let operationId: string;
  try {
    const prepared = await withSerializationRetry(() => db.$transaction(async (tx) => {
      const current = await tx.signatureCapture.findUnique({ where: { id: target.id }, select: { captureVersion: true, collectionId: true, memberId: true, settingsVersion: true } });
      if (!current || current.collectionId !== target.collectionId || current.memberId !== target.memberId || current.captureVersion !== input.request.expectedCaptureVersion || current.settingsVersion !== input.request.settingsVersion) throw new HttpError(409, "This signature changed elsewhere; keep the local draft and reload");
      const latest = await tx.signatureArtifactRevision.findFirst({ where: { captureId: target.id }, orderBy: { revision: "desc" }, select: { revision: true } });
      const revision = await tx.signatureArtifactRevision.create({ data: { id: revisionId, captureId: target.id, revision: (latest?.revision ?? 0) + 1, state: SignatureArtifactState.PENDING_DELETE, pngPath, svgPath, pngHash: artifacts.pngHash, svgHash: artifacts.svgHash, width: artifacts.width, height: artifacts.height, cropBounds: signatureJson(artifacts.cropBounds) } });
      const operation = await tx.signatureSaveOperation.create({ data: { requestId: input.request.requestId, collectionId: target.collectionId, memberId: target.memberId, captureId: target.id, expectedCaptureVersion: input.request.expectedCaptureVersion, settingsVersion: input.request.settingsVersion, status: SignatureSaveStatus.UPLOADING, revisionId: revision.id, actorUserId: input.actor.id } });
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
        collectionId: target.collectionId,
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
        await tx.signatureArtifactRevision.update({ where: { id: current.currentRevisionId }, data: { replacedAt: new Date() } });
      }
      const now = new Date();
      const revision = await tx.signatureArtifactRevision.update({ where: { id: input.revisionId }, data: { state: SignatureArtifactState.READY, committedAt: now } });
      const capture = await tx.signatureCapture.update({ where: { id: input.captureId }, data: { currentRevisionId: revision.id, captureVersion: { increment: 1 }, capturedAt: now, capturedById: input.actor.id }, select: { captureVersion: true } });
      await tx.signatureCollection.updateMany({ where: { id: input.collectionId, firstCaptureAt: null }, data: { firstCaptureAt: now, updatedById: input.actor.id } });
      await tx.signatureSaveOperation.update({ where: { id: input.operationId }, data: { status: SignatureSaveStatus.COMMITTED, committedAt: now } });
      await createAuditEntryTx(tx, { actorId: input.actor.id, actorRole: input.actor.role, entityType: "SignatureCapture", entityId: input.captureId, action: "SAVE", before: { captureVersion: input.expectedCaptureVersion, priorRevisionId: current.currentRevisionId, priorPngHash: current.currentRevision?.pngHash ?? null, priorSvgHash: current.currentRevision?.svgHash ?? null }, after: { captureVersion: capture.captureVersion, revisionId: revision.id, pngHash: revision.pngHash, svgHash: revision.svgHash, width: revision.width, height: revision.height } });
      return { captureVersion: capture.captureVersion, revision };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getReadySignatureArtifact(revisionId: string, kind: "png" | "svg") {
  const revision = await db.signatureArtifactRevision.findUnique({
    where: { id: revisionId },
    include: { capture: { include: { member: true } } },
  });
  if (!revision || revision.state !== SignatureArtifactState.READY) {
    throw new HttpError(404, "Signature artifact not found");
  }
  return {
    path: kind === "png" ? revision.pngPath : revision.svgPath,
    contentType: kind === "png" ? "image/png" : "image/svg+xml",
    filename: signatureArtifactFilename(
      revision.capture.member.name,
      kind,
      revision.capture.currentRevisionId === revision.id ? undefined : revision.revision,
    ),
  };
}

export function signatureArtifactFilename(name: string, kind: "png" | "svg", revision?: number) {
  const signer = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const version = revision === undefined ? "" : `-v${revision}`;
  return signer ? `${signer}-signature${version}.${kind}` : `signature${version}.${kind}`;
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
