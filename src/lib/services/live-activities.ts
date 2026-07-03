import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  endCheckoutReturnLiveActivityTokens,
  startCheckoutReturnLiveActivityTokens,
  updateCheckoutReturnLiveActivityTokens,
} from "@/lib/push/apns";
import { BookingKind, BookingStatus } from "@prisma/client";

const CHECKOUT_RETURN_ACTIVITY = "checkout_return";
const DEFAULT_LEAD_MS = 30 * 60_000;
const OVERDUE_START_WINDOW_MS = 6 * 60 * 60_000;

function initialsFor(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return letters ? letters.toUpperCase() : "?";
}

function returnTimeText(date: Date): string {
  return `Return ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: env.appTimezone,
  }).format(date)}`;
}

function urgencyFor(endsAt: Date, now: Date): "normal" | "warning" | "critical" | "overdue" {
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return "overdue";
  if (remaining <= 10 * 60_000) return "critical";
  if (remaining <= 30 * 60_000) return "warning";
  return "normal";
}

export async function registerCheckoutReturnLiveActivityStartToken(args: {
  userId: string;
  token: string;
}) {
  const now = new Date();
  await db.liveActivityStartToken.upsert({
    where: { token: args.token },
    update: {
      userId: args.userId,
      activity: CHECKOUT_RETURN_ACTIVITY,
      lastSeenAt: now,
      revokedAt: null,
    },
    create: {
      userId: args.userId,
      token: args.token,
      activity: CHECKOUT_RETURN_ACTIVITY,
    },
  });
}

export async function revokeCheckoutReturnLiveActivityStartTokens(userId: string) {
  await db.liveActivityStartToken.updateMany({
    where: {
      userId,
      activity: CHECKOUT_RETURN_ACTIVITY,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function registerCheckoutReturnLiveActivity(args: {
  userId: string;
  bookingId: string;
  token: string;
}) {
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.liveActivityToken.updateMany({
      where: {
        userId: args.userId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        bookingId: { not: args.bookingId },
        endedAt: null,
      },
      data: { endedAt: now },
    });

    await tx.liveActivityToken.upsert({
      where: { token: args.token },
      update: {
        userId: args.userId,
        bookingId: args.bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        lastSeenAt: now,
        endedAt: null,
      },
      create: {
        userId: args.userId,
        bookingId: args.bookingId,
        token: args.token,
        activity: CHECKOUT_RETURN_ACTIVITY,
      },
    });
  });
}

export async function endCheckoutReturnLiveActivities(bookingId: string) {
  try {
    const rows = await db.liveActivityToken.findMany({
      where: {
        bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      select: { token: true },
    });

    if (rows.length === 0) {
      await db.liveActivityStart.updateMany({
        where: {
          bookingId,
          activity: CHECKOUT_RETURN_ACTIVITY,
          endedAt: null,
        },
        data: { endedAt: new Date() },
      });
      return;
    }

    const tokens = rows.map((row) => row.token);
    const { revoked } = await endCheckoutReturnLiveActivityTokens(tokens);
    const endedAt = new Date();

    await db.liveActivityToken.updateMany({
      where: { token: { in: tokens } },
      data: { endedAt },
    });
    await db.liveActivityStart.updateMany({
      where: {
        bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      data: { endedAt },
    });

    if (revoked.length > 0) {
      await db.liveActivityToken.updateMany({
        where: { token: { in: revoked } },
        data: { endedAt },
      });
    }
  } catch (error) {
    console.error("[LiveActivity] failed to end checkout return activity", {
      bookingId,
      error,
    });
  }
}

export async function startDueCheckoutReturnLiveActivities(args: {
  now?: Date;
  leadMs?: number;
  overdueWindowMs?: number;
  limit?: number;
} = {}) {
  const now = args.now ?? new Date();
  const leadMs = args.leadMs ?? DEFAULT_LEAD_MS;
  const overdueWindowMs = args.overdueWindowMs ?? OVERDUE_START_WINDOW_MS;
  const leadCutoff = new Date(now.getTime() + leadMs);
  const overdueCutoff = new Date(now.getTime() - overdueWindowMs);

  const dueCheckouts = await db.booking.findMany({
    where: {
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.OPEN,
      endsAt: {
        gte: overdueCutoff,
        lte: leadCutoff,
      },
      liveActivityTokens: {
        none: {
          activity: CHECKOUT_RETURN_ACTIVITY,
          endedAt: null,
        },
      },
      liveActivityStarts: {
        none: {
          activity: CHECKOUT_RETURN_ACTIVITY,
          endedAt: null,
        },
      },
      requester: {
        liveActivityStartTokens: {
          some: {
            activity: CHECKOUT_RETURN_ACTIVITY,
            revokedAt: null,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      endsAt: true,
      requesterUserId: true,
      requester: {
        select: {
          name: true,
          avatarUrl: true,
          liveActivityStartTokens: {
            where: {
              activity: CHECKOUT_RETURN_ACTIVITY,
              revokedAt: null,
            },
            select: { token: true },
          },
        },
      },
    },
    orderBy: { endsAt: "asc" },
    take: args.limit ?? 50,
  });

  const scanned = dueCheckouts.length;
  let started = 0;
  let revoked = 0;

  for (const booking of dueCheckouts) {
    const tokens = booking.requester.liveActivityStartTokens.map((row) => row.token);
    const result = await startCheckoutReturnLiveActivityTokens(
      tokens,
      {
        bookingId: booking.id,
        bookingTitle: booking.title,
        requesterName: booking.requester.name,
        requesterInitials: initialsFor(booking.requester.name),
        requesterAvatarUrl: booking.requester.avatarUrl,
        returnTimeText: returnTimeText(booking.endsAt),
      },
      {
        endsAt: booking.endsAt,
        nextNeedAt: null,
        allowsExtend: true,
        urgency: urgencyFor(booking.endsAt, now),
      },
    );

    if (result.revoked.length > 0) {
      revoked += result.revoked.length;
      await db.liveActivityStartToken.updateMany({
        where: { token: { in: result.revoked } },
        data: { revokedAt: new Date() },
      });
    }

    if (result.ok > 0) {
      started += result.ok;
      await db.liveActivityStart.upsert({
        where: {
          userId_bookingId_activity: {
            userId: booking.requesterUserId,
            bookingId: booking.id,
            activity: CHECKOUT_RETURN_ACTIVITY,
          },
        },
        update: {
          lastAttemptAt: now,
          endedAt: null,
        },
        create: {
          userId: booking.requesterUserId,
          bookingId: booking.id,
          activity: CHECKOUT_RETURN_ACTIVITY,
          startedAt: now,
          lastAttemptAt: now,
        },
      });
    }
  }

  return {
    scanned,
    started,
    revoked,
  };
}

export async function updateCheckoutReturnLiveActivities(args: {
  bookingId: string;
  endsAt: Date;
}) {
  try {
    const rows = await db.liveActivityToken.findMany({
      where: {
        bookingId: args.bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      select: { token: true },
    });

    if (rows.length === 0) return;

    const now = new Date();
    const remaining = args.endsAt.getTime() - now.getTime();
    const urgency =
      remaining <= 0
        ? "overdue"
        : remaining <= 10 * 60_000
          ? "critical"
          : remaining <= 30 * 60_000
            ? "warning"
            : "normal";

    const { revoked } = await updateCheckoutReturnLiveActivityTokens(
      rows.map((row) => row.token),
      {
        endsAt: args.endsAt,
        nextNeedAt: null,
        allowsExtend: true,
        urgency,
      },
    );

    if (revoked.length > 0) {
      await db.liveActivityToken.updateMany({
        where: { token: { in: revoked } },
        data: { endedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("[LiveActivity] failed to update checkout return activity", {
      bookingId: args.bookingId,
      error,
    });
  }
}
