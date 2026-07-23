import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  endCheckoutReturnLiveActivityTokens,
  startCheckoutReturnLiveActivityTokens,
  updateCheckoutReturnLiveActivityTokens,
} from "@/lib/push/apns";
import { BookingKind, BookingStatus } from "@prisma/client";
import { checkUpcomingSerializedCommitments } from "@/lib/services/availability";

const CHECKOUT_RETURN_ACTIVITY = "checkout_return";
const DEFAULT_LEAD_MS = 30 * 60_000;
const OVERDUE_START_WINDOW_MS = 6 * 60 * 60_000;
const OVERDUE_SWEEP_WINDOW_MS = 6 * 60_000;

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

/**
 * Server-side twin of the iOS reconciler's `checkoutReturnInsight`.
 *
 * Both paths can drive the same Live Activity, so they have to agree. The
 * server used to hardcode `nextNeedAt: null, allowsExtend: true`, which meant
 * any push update wiped the "Needed again 4:30" line the app had computed and
 * re-offered Extend on gear another booking needs next.
 *
 * Mirrors the app's rule exactly: extending is allowed only when nothing is
 * already committed to this gear after the current return time.
 */
async function checkoutReturnInsight(args: {
  bookingId: string;
  endsAt: Date;
}): Promise<{ nextNeedAt: Date | null; allowsExtend: boolean }> {
  // Live Activity content is best-effort. On any failure fall back to the
  // permissive values rather than dropping the update entirely.
  try {
    const allocations = await db.assetAllocation.findMany({
      where: { bookingId: args.bookingId, active: true },
      select: { assetId: true },
    });
    const serializedAssetIds = [...new Set(allocations.map((row) => row.assetId))];
    if (serializedAssetIds.length === 0) return { nextNeedAt: null, allowsExtend: true };

    const commitments = await checkUpcomingSerializedCommitments(db, {
      serializedAssetIds,
      endsAt: args.endsAt,
      excludeBookingId: args.bookingId,
    });

    const nextNeedAt = commitments.reduce<Date | null>(
      (soonest, c) => (soonest === null || c.startsAt < soonest ? c.startsAt : soonest),
      null,
    );
    return { nextNeedAt, allowsExtend: nextNeedAt === null };
  } catch (error) {
    console.error("[LiveActivity] failed to resolve return insight", {
      bookingId: args.bookingId,
      error,
    });
    return { nextNeedAt: null, allowsExtend: true };
  }
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

/**
 * Closes out the per-activity update tokens a user still has open. Sign-out
 * previously revoked only the push-to-start tokens, so on a shared iPad the
 * server went on believing the previous user had a live activity running after
 * somebody else signed in. The app ends the activity locally at the same
 * moment, so these tokens are already dead; this stops us pushing at them.
 */
export async function endCheckoutReturnLiveActivitiesForUser(userId: string) {
  try {
    await db.liveActivityToken.updateMany({
      where: {
        userId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      data: { endedAt: new Date() },
    });
  } catch (error) {
    console.error("[LiveActivity] failed to end activities for user", { userId, error });
  }
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
    const insight = await checkoutReturnInsight({ bookingId: booking.id, endsAt: booking.endsAt });
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
        nextNeedAt: insight.nextNeedAt,
        allowsExtend: insight.allowsExtend,
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

export async function startCheckoutReturnLiveActivityForBooking(args: {
  bookingId: string;
  expectedEndsAt: Date;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const booking = await db.booking.findFirst({
    where: {
      id: args.bookingId,
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.OPEN,
      endsAt: args.expectedEndsAt,
      liveActivityTokens: {
        none: { activity: CHECKOUT_RETURN_ACTIVITY, endedAt: null },
      },
      liveActivityStarts: {
        none: { activity: CHECKOUT_RETURN_ACTIVITY, endedAt: null },
      },
      requester: {
        liveActivityStartTokens: {
          some: { activity: CHECKOUT_RETURN_ACTIVITY, revokedAt: null },
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
            where: { activity: CHECKOUT_RETURN_ACTIVITY, revokedAt: null },
            select: { token: true },
          },
        },
      },
    },
  });

  if (!booking) return { started: 0, revoked: 0, skipped: true };

  const tokens = booking.requester.liveActivityStartTokens.map((row) => row.token);
  const insight = await checkoutReturnInsight({ bookingId: booking.id, endsAt: booking.endsAt });
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
      nextNeedAt: insight.nextNeedAt,
      allowsExtend: insight.allowsExtend,
      urgency: urgencyFor(booking.endsAt, now),
    },
  );

  if (result.revoked.length > 0) {
    await db.liveActivityStartToken.updateMany({
      where: { token: { in: result.revoked } },
      data: { revokedAt: now },
    });
  }

  if (result.ok > 0) {
    await db.liveActivityStart.upsert({
      where: {
        userId_bookingId_activity: {
          userId: booking.requesterUserId,
          bookingId: booking.id,
          activity: CHECKOUT_RETURN_ACTIVITY,
        },
      },
      update: { lastAttemptAt: now, endedAt: null },
      create: {
        userId: booking.requesterUserId,
        bookingId: booking.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        startedAt: now,
        lastAttemptAt: now,
      },
    });
  }

  return {
    started: result.ok,
    revoked: result.revoked.length,
    skipped: false,
  };
}

/**
 * Pushes the overdue state and alert for one booking's Live Activity.
 *
 * The batch sweep below only ever runs from `/api/cron/live-activities`, which
 * is deliberately not registered in `vercel.json` — remote start is driven by
 * the durable workflow instead. That left the overdue alert with no caller at
 * all: the widget's own `TimelineView` turns the countdown red on schedule, so
 * it *looks* right, but the alert that surfaces it never fired. This is the
 * workflow-driven equivalent, scheduled for the return time itself.
 *
 * `expectedEndsAt` must still match: extending a checkout schedules a fresh
 * workflow, and the superseded run has to no-op rather than declare gear
 * overdue that now has more time.
 */
export async function markCheckoutReturnLiveActivityOverdue(args: {
  bookingId: string;
  expectedEndsAt: Date;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  try {
    const booking = await db.booking.findFirst({
      where: {
        id: args.bookingId,
        kind: BookingKind.CHECKOUT,
        status: BookingStatus.OPEN,
        endsAt: args.expectedEndsAt,
      },
      select: {
        id: true,
        title: true,
        endsAt: true,
        liveActivityTokens: {
          where: { activity: CHECKOUT_RETURN_ACTIVITY, endedAt: null },
          select: { token: true },
        },
      },
    });

    if (!booking) return { notified: 0, revoked: 0, skipped: true };

    const tokens = booking.liveActivityTokens.map((row) => row.token);
    if (tokens.length === 0) return { notified: 0, revoked: 0, skipped: true };

    const insight = await checkoutReturnInsight({ bookingId: booking.id, endsAt: booking.endsAt });
    const result = await updateCheckoutReturnLiveActivityTokens(
      tokens,
      {
        endsAt: booking.endsAt,
        nextNeedAt: insight.nextNeedAt,
        // See the sweep: past the return time the answer is bring it back.
        allowsExtend: false,
        urgency: urgencyFor(booking.endsAt, now),
      },
      {
        alert: {
          title: "Overdue",
          body: `${booking.title} is overdue for return`,
        },
      },
    );

    if (result.revoked.length > 0) {
      await db.liveActivityToken.updateMany({
        where: { token: { in: result.revoked } },
        data: { endedAt: now },
      });
    }

    return {
      notified: tokens.length - result.revoked.length,
      revoked: result.revoked.length,
      skipped: false,
    };
  } catch (error) {
    console.error("[LiveActivity] failed to mark checkout return overdue", {
      bookingId: args.bookingId,
      error,
    });
    return { notified: 0, revoked: 0, skipped: true };
  }
}

export async function sweepOverdueCheckoutReturnLiveActivities(args: {
  now?: Date;
  windowMs?: number;
  limit?: number;
} = {}) {
  const now = args.now ?? new Date();
  const windowMs = args.windowMs ?? OVERDUE_SWEEP_WINDOW_MS;
  const windowStart = new Date(now.getTime() - windowMs);

  const overdueCheckouts = await db.booking.findMany({
    where: {
      kind: BookingKind.CHECKOUT,
      status: BookingStatus.OPEN,
      endsAt: {
        gte: windowStart,
        lte: now,
      },
      liveActivityTokens: {
        some: {
          activity: CHECKOUT_RETURN_ACTIVITY,
          endedAt: null,
        },
      },
    },
    select: {
      id: true,
      title: true,
      endsAt: true,
      liveActivityTokens: {
        where: {
          activity: CHECKOUT_RETURN_ACTIVITY,
          endedAt: null,
        },
        select: { token: true },
      },
    },
    orderBy: { endsAt: "asc" },
    take: args.limit ?? 50,
  });

  const scanned = overdueCheckouts.length;
  let notified = 0;
  let revoked = 0;

  for (const booking of overdueCheckouts) {
    const tokens = booking.liveActivityTokens.map((row) => row.token);
    if (tokens.length === 0) continue;

    const insight = await checkoutReturnInsight({ bookingId: booking.id, endsAt: booking.endsAt });
    const result = await updateCheckoutReturnLiveActivityTokens(
      tokens,
      {
        endsAt: booking.endsAt,
        nextNeedAt: insight.nextNeedAt,
        // Overdue deliberately withholds Extend regardless of the insight:
        // the return window has already lapsed, so the answer is bring it back.
        allowsExtend: false,
        urgency: urgencyFor(booking.endsAt, now),
      },
      {
        alert: {
          title: "Overdue",
          body: `${booking.title} is overdue for return`,
        },
      },
    );

    if (result.revoked.length > 0) {
      revoked += result.revoked.length;
      await db.liveActivityToken.updateMany({
        where: { token: { in: result.revoked } },
        data: { endedAt: now },
      });
    }

    notified += tokens.length - result.revoked.length;
  }

  return {
    scanned,
    notified,
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

    const insight = await checkoutReturnInsight({
      bookingId: args.bookingId,
      endsAt: args.endsAt,
    });

    const { revoked } = await updateCheckoutReturnLiveActivityTokens(
      rows.map((row) => row.token),
      {
        endsAt: args.endsAt,
        nextNeedAt: insight.nextNeedAt,
        allowsExtend: insight.allowsExtend,
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
