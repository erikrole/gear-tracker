import { LicenseCodeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { sendPush } from "@/lib/push/apns";

export async function listCodes() {
  return db.licenseCode.findMany({
    where: { status: { not: LicenseCodeStatus.RETIRED } },
    include: {
      claimedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function listAllCodes() {
  return db.licenseCode.findMany({
    include: {
      claimedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function getActiveClaimForUser(userId: string) {
  return db.licenseCode.findFirst({
    where: { status: LicenseCodeStatus.CLAIMED, claimedById: userId },
    select: { id: true, code: true, label: true, claimedAt: true },
  });
}

export async function claimCode(codeId: string, userId: string) {
  // Block if user already holds a code
  const existing = await db.licenseCode.findFirst({
    where: { status: LicenseCodeStatus.CLAIMED, claimedById: userId },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "You already have an active Photo Mechanic license. Return it before claiming another.");
  }

  return db.$transaction(async (tx) => {
    const code = await tx.licenseCode.findUnique({ where: { id: codeId } });
    if (!code) throw new HttpError(404, "License code not found.");
    if (code.status !== LicenseCodeStatus.AVAILABLE) {
      throw new HttpError(409, "This license code is no longer available.");
    }

    const now = new Date();
    const updated = await tx.licenseCode.update({
      where: { id: codeId },
      data: {
        status: LicenseCodeStatus.CLAIMED,
        claimedById: userId,
        claimedAt: now,
      },
    });

    await tx.licenseCodeClaim.create({
      data: {
        licenseCodeId: codeId,
        userId,
        claimedAt: now,
      },
    });

    return updated;
  });
}

export async function releaseCode(codeId: string, requesterId: string, isAdmin: boolean) {
  const code = await db.licenseCode.findUnique({ where: { id: codeId } });
  if (!code) throw new HttpError(404, "License code not found.");
  if (code.status !== LicenseCodeStatus.CLAIMED) {
    throw new HttpError(409, "This license code is not currently claimed.");
  }
  if (!isAdmin && code.claimedById !== requesterId) {
    throw new HttpError(403, "You can only release your own license.");
  }

  return db.$transaction(async (tx) => {
    const now = new Date();
    await tx.licenseCodeClaim.updateMany({
      where: { licenseCodeId: codeId, releasedAt: null },
      data: {
        releasedAt: now,
        releasedById: isAdmin && code.claimedById !== requesterId ? requesterId : null,
      },
    });

    return tx.licenseCode.update({
      where: { id: codeId },
      data: {
        status: LicenseCodeStatus.AVAILABLE,
        claimedById: null,
        claimedAt: null,
        nagSentAt: null,
      },
    });
  });
}

export async function createCode(code: string, label: string | undefined, createdById: string) {
  return db.licenseCode.create({
    data: { code: code.trim(), label, createdById },
  });
}

export async function bulkCreateCodes(
  rawLines: string,
  createdById: string
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
    data: newCodes.map((code) => ({ code, createdById })),
  });

  return { created: newCodes.length, skipped: codes.length - newCodes.length };
}

export async function retireCode(codeId: string) {
  const code = await db.licenseCode.findUnique({ where: { id: codeId } });
  if (!code) throw new HttpError(404, "License code not found.");
  if (code.status === LicenseCodeStatus.CLAIMED) {
    throw new HttpError(409, "Cannot retire a claimed license. Release it first.");
  }
  return db.licenseCode.update({
    where: { id: codeId },
    data: { status: LicenseCodeStatus.RETIRED },
  });
}

export async function deleteCode(codeId: string) {
  const code = await db.licenseCode.findUnique({ where: { id: codeId } });
  if (!code) throw new HttpError(404, "License code not found.");
  if (code.status === LicenseCodeStatus.CLAIMED) {
    throw new HttpError(409, "Cannot delete a claimed license. Release it first.");
  }
  return db.licenseCode.delete({ where: { id: codeId } });
}

export async function updateCodeLabel(codeId: string, label: string | undefined) {
  return db.licenseCode.update({
    where: { id: codeId },
    data: { label },
  });
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

export async function processLicenseNags() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const overdue = await db.licenseCode.findMany({
    where: {
      status: LicenseCodeStatus.CLAIMED,
      nagSentAt: null,
      claimedAt: { lt: twoDaysAgo },
      claimedById: { not: null },
    },
    select: { id: true, claimedById: true, claimedAt: true },
  });

  for (const code of overdue) {
    if (!code.claimedById) continue;
    const title = "Still using Photo Mechanic?";
    const body = "You've had a license for 2+ days. Return it from the app if you're done so someone else can use it.";
    const dedupeKey = `license-nag-${code.id}-${code.claimedAt?.toISOString()}`;

    try {
      await db.notification.upsert({
        where: { dedupeKey },
        create: {
          userId: code.claimedById,
          type: "license_held_2d",
          title,
          body,
          channel: "IN_APP",
          dedupeKey,
        },
        update: {},
      });

      await sendPushToUser(code.claimedById, {
        title,
        body,
        payload: { type: "license_nag", licenseCodeId: code.id },
      });

      await db.licenseCode.update({
        where: { id: code.id },
        data: { nagSentAt: new Date() },
      });
    } catch (err) {
      console.error(`[LICENSE_NAGS] Failed for code ${code.id}:`, err);
    }
  }

  return { nagged: overdue.length };
}
