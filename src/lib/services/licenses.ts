import { LicenseCodeStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { sendPush } from "@/lib/push/apns";

const MAX_SLOTS = 2;

// Postgres serialization-failure SQLSTATE. Retry once on conflict —
// covers the rare two-students-tap-the-last-slot race.
const SERIALIZATION_FAILURE = "40001";

async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const meta = (err as { meta?: { code?: string } })?.meta?.code;
    if (code === SERIALIZATION_FAILURE || meta === SERIALIZATION_FAILURE || code === "P2034") {
      return await fn();
    }
    throw err;
  }
}

const activeClaimsInclude = {
  where: { releasedAt: null as null },
  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  orderBy: { claimedAt: "asc" as const },
};

export async function listCodes() {
  return db.licenseCode.findMany({
    where: { status: { not: LicenseCodeStatus.RETIRED } },
    include: { claims: activeClaimsInclude },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function listAllCodes() {
  return db.licenseCode.findMany({
    include: { claims: activeClaimsInclude },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function getActiveClaimForUser(userId: string) {
  const claim = await db.licenseCodeClaim.findFirst({
    where: { userId, releasedAt: null },
    include: { licenseCode: { select: { id: true, code: true, label: true } } },
  });
  if (!claim) return null;
  return {
    id: claim.licenseCode.id,
    code: claim.licenseCode.code,
    label: claim.licenseCode.label,
    claimedAt: claim.claimedAt,
    claimId: claim.id,
  };
}

export async function claimCode(codeId: string, userId: string) {
  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.licenseCodeClaim.findFirst({
          where: { userId, releasedAt: null },
          select: { id: true },
        });
        if (existing) {
          throw new HttpError(409, "You already have an active Photo Mechanic license. Return it before claiming another.");
        }

        const code = await tx.licenseCode.findUnique({
          where: { id: codeId },
          include: { claims: { where: { releasedAt: null } } },
        });
        if (!code) throw new HttpError(404, "License code not found.");
        if (code.status === LicenseCodeStatus.RETIRED) throw new HttpError(409, "This license code is retired.");

        const activeCount = code.claims.length;
        if (activeCount >= MAX_SLOTS) throw new HttpError(409, "This license code is fully claimed.");

        const now = new Date();
        await tx.licenseCodeClaim.create({
          data: { licenseCodeId: codeId, userId, claimedAt: now },
        });

        const newStatus = activeCount + 1 >= MAX_SLOTS ? LicenseCodeStatus.CLAIMED : LicenseCodeStatus.PARTIAL;
        return tx.licenseCode.update({
          where: { id: codeId },
          data: {
            status: newStatus,
            ...(activeCount === 0 ? { claimedById: userId, claimedAt: now } : {}),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function releaseCode(
  codeId: string,
  requesterId: string,
  isAdmin: boolean,
  claimId?: string
) {
  return db.$transaction(async (tx) => {
    let claim;
    if (claimId) {
      if (!isAdmin) throw new HttpError(403, "Only admins can release by claim ID.");
      claim = await tx.licenseCodeClaim.findUnique({ where: { id: claimId } });
      if (!claim || claim.licenseCodeId !== codeId || claim.releasedAt) {
        throw new HttpError(404, "Active claim not found.");
      }
    } else {
      claim = await tx.licenseCodeClaim.findFirst({
        where: { licenseCodeId: codeId, userId: requesterId, releasedAt: null },
      });
      if (!claim) {
        if (isAdmin) {
          // Admin releasing without specifying a claim — release all
          const allActive = await tx.licenseCodeClaim.findMany({
            where: { licenseCodeId: codeId, releasedAt: null },
          });
          if (allActive.length === 0) throw new HttpError(409, "No active claims to release.");
          const now = new Date();
          await tx.licenseCodeClaim.updateMany({
            where: { licenseCodeId: codeId, releasedAt: null },
            data: { releasedAt: now, releasedById: requesterId },
          });
          return tx.licenseCode.update({
            where: { id: codeId },
            data: { status: LicenseCodeStatus.AVAILABLE, claimedById: null, claimedAt: null, nagSentAt: null },
          });
        }
        throw new HttpError(404, "No active claim found for your account.");
      }
      if (!isAdmin && claim.userId !== requesterId) {
        throw new HttpError(403, "You can only release your own license.");
      }
    }

    const now = new Date();
    await tx.licenseCodeClaim.update({
      where: { id: claim.id },
      data: {
        releasedAt: now,
        releasedById: claim.userId !== requesterId ? requesterId : null,
      },
    });

    const remaining = await tx.licenseCodeClaim.findMany({
      where: { licenseCodeId: codeId, releasedAt: null },
      orderBy: { claimedAt: "asc" },
    });

    const newStatus =
      remaining.length === 0 ? LicenseCodeStatus.AVAILABLE
      : remaining.length < MAX_SLOTS ? LicenseCodeStatus.PARTIAL
      : LicenseCodeStatus.CLAIMED;

    return tx.licenseCode.update({
      where: { id: codeId },
      data: {
        status: newStatus,
        claimedById: remaining[0]?.userId ?? null,
        claimedAt: remaining[0]?.claimedAt ?? null,
        nagSentAt: null,
      },
    });
  });
}

export async function addUnknownOccupant(codeId: string, label: string, _adminId: string) {
  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const code = await tx.licenseCode.findUnique({
          where: { id: codeId },
          include: { claims: { where: { releasedAt: null } } },
        });
        if (!code) throw new HttpError(404, "License code not found.");
        if (code.status === LicenseCodeStatus.RETIRED) throw new HttpError(409, "This license code is retired.");
        if (code.claims.length >= MAX_SLOTS) throw new HttpError(409, "This license code is fully claimed.");

        const now = new Date();
        await tx.licenseCodeClaim.create({
          data: { licenseCodeId: codeId, userId: null, occupantLabel: label.trim(), claimedAt: now },
        });

        const activeCount = code.claims.length + 1;
        const newStatus = activeCount >= MAX_SLOTS ? LicenseCodeStatus.CLAIMED : LicenseCodeStatus.PARTIAL;
        return tx.licenseCode.update({
          where: { id: codeId },
          data: { status: newStatus },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function createCode(
  code: string,
  label: string | undefined,
  createdById: string,
  accountEmail?: string,
  expiresAt?: Date
) {
  return db.licenseCode.create({
    data: { code: code.trim(), label, createdById, accountEmail, expiresAt },
  });
}

export async function bulkCreateCodes(
  rawLines: string,
  createdById: string,
  shared: { accountEmail?: string; expiresAt?: Date } = {}
): Promise<{ created: number; skipped: number }> {
  const codes = rawLines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (codes.length === 0) throw new HttpError(400, "No codes provided.");

  const existing = await db.licenseCode.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  });
  const existingSet = new Set(existing.map((e) => e.code));
  const newCodes = codes.filter((c) => !existingSet.has(c));

  if (newCodes.length === 0) return { created: 0, skipped: codes.length };

  await db.licenseCode.createMany({
    data: newCodes.map((code) => ({
      code,
      createdById,
      accountEmail: shared.accountEmail,
      expiresAt: shared.expiresAt,
    })),
  });

  return { created: newCodes.length, skipped: codes.length - newCodes.length };
}

export async function retireCode(codeId: string) {
  const code = await db.licenseCode.findUnique({
    where: { id: codeId },
    include: { claims: { where: { releasedAt: null } } },
  });
  if (!code) throw new HttpError(404, "License code not found.");
  if (code.claims.length > 0) {
    throw new HttpError(409, "Cannot retire a license with active claims. Release all slots first.");
  }
  return db.licenseCode.update({
    where: { id: codeId },
    data: { status: LicenseCodeStatus.RETIRED },
  });
}

export async function deleteCode(codeId: string) {
  const code = await db.licenseCode.findUnique({
    where: { id: codeId },
    include: { claims: { where: { releasedAt: null } } },
  });
  if (!code) throw new HttpError(404, "License code not found.");
  if (code.claims.length > 0) {
    throw new HttpError(409, "Cannot delete a license with active claims. Release all slots first.");
  }
  return db.licenseCode.delete({ where: { id: codeId } });
}

export async function updateCodeDetails(
  codeId: string,
  data: { label?: string; accountEmail?: string | null; expiresAt?: Date | null }
) {
  return db.licenseCode.update({ where: { id: codeId }, data });
}

export async function getClaimHistory(codeId: string) {
  return db.licenseCodeClaim.findMany({
    where: { licenseCodeId: codeId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { claimedAt: "desc" },
  });
}

async function sendPushToUser(
  userId: string,
  opts: { title: string; body: string; payload?: Record<string, unknown> }
) {
  const tokens = await db.deviceToken.findMany({
    where: { userId, revokedAt: null },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  const { revoked } = await sendPush(
    tokens.map((t) => t.token),
    { title: opts.title, body: opts.body, payload: opts.payload }
  );

  if (revoked.length > 0) {
    await db.deviceToken.updateMany({
      where: { token: { in: revoked } },
      data: { revokedAt: new Date() },
    });
  }
}

export async function processExpiryWarnings() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const expiring = await db.licenseCode.findMany({
    where: {
      status: { not: LicenseCodeStatus.RETIRED },
      expiresAt: { not: null, lte: horizon },
    },
    select: { id: true, code: true, label: true, expiresAt: true },
  });

  if (expiring.length === 0) return { warned: 0 };

  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: { id: true },
  });
  if (admins.length === 0) return { warned: 0 };

  let warned = 0;

  for (const code of expiring) {
    if (!code.expiresAt) continue;
    const yearMonth = `${code.expiresAt.getUTCFullYear()}-${String(code.expiresAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const isExpired = code.expiresAt < now;
    const daysLeft = Math.ceil((code.expiresAt.getTime() - now.getTime()) / 86_400_000);

    const title = isExpired
      ? "Photo Mechanic license expired"
      : `Photo Mechanic license expiring in ${daysLeft}d`;
    const body = `${code.label ?? code.code}${code.label ? ` (${code.code})` : ""} · Renew soon to avoid disruption.`;

    for (const admin of admins) {
      const dedupeKey = `license-expiry-${code.id}-${yearMonth}-${admin.id}`;
      try {
        const existing = await db.notification.findUnique({ where: { dedupeKey } });
        if (existing) continue;

        await db.notification.create({
          data: {
            userId: admin.id,
            type: isExpired ? "license_expired" : "license_expiring_soon",
            title,
            body,
            channel: "IN_APP",
            dedupeKey,
          },
        });

        await sendPushToUser(admin.id, {
          title,
          body,
          payload: { type: "license_expiry", licenseCodeId: code.id },
        });

        warned++;
      } catch (err) {
        console.error(`[LICENSE_EXPIRY] Failed for code ${code.id} admin ${admin.id}:`, err);
      }
    }
  }

  return { warned };
}

export async function processLicenseNags() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // Staff and admins hold licenses with indefinite custody — only students get nagged to rotate.
  const overdueClaims = await db.licenseCodeClaim.findMany({
    where: {
      releasedAt: null,
      userId: { not: null },
      claimedAt: { lt: twoDaysAgo },
      licenseCode: { nagSentAt: null },
      user: { role: "STUDENT" },
    },
    select: { id: true, userId: true, claimedAt: true, licenseCodeId: true },
  });

  const nagged = new Set<string>();

  for (const claim of overdueClaims) {
    if (!claim.userId || nagged.has(claim.licenseCodeId)) continue;
    nagged.add(claim.licenseCodeId);

    const title = "Still using Photo Mechanic?";
    const body = "You've had a license for 2+ days. Return it from the app if you're done so someone else can use it.";
    const dedupeKey = `license-nag-${claim.licenseCodeId}-${claim.claimedAt?.toISOString()}`;

    try {
      await db.notification.upsert({
        where: { dedupeKey },
        create: {
          userId: claim.userId,
          type: "license_held_2d",
          title,
          body,
          channel: "IN_APP",
          dedupeKey,
        },
        update: {},
      });

      await sendPushToUser(claim.userId, {
        title,
        body,
        payload: { type: "license_nag", licenseCodeId: claim.licenseCodeId },
      });

      await db.licenseCode.update({
        where: { id: claim.licenseCodeId },
        data: { nagSentAt: new Date() },
      });
    } catch (err) {
      console.error(`[LICENSE_NAGS] Failed for code ${claim.licenseCodeId}:`, err);
    }
  }

  return { nagged: nagged.size };
}
