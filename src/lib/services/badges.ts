import { db } from "@/lib/db";
import type { BadgeCategory } from "@prisma/client";

// ── Types ───────────────────────────────────────────────

export type BadgeTrigger =
  | "booking_completed"
  | "checkout_scan_completed"
  | "checkin_scan_completed"
  | "shift_approved"
  | "shift_no_show"
  | "shift_trade_completed"
  | "badge_earned";

interface TriggerContext {
  bookingId?: string;
  shiftAssignmentId?: string;
  shiftTradeId?: string;
}

interface BadgeRule {
  slug: string;
  triggers: BadgeTrigger[];
  evaluate: (userId: string, ctx: TriggerContext) => Promise<boolean>;
}

// ── Streak Helpers ──────────────────────────────────────

async function incrementStreak(userId: string, streakType: string): Promise<number> {
  const streak = await db.badgeStreak.upsert({
    where: { userId_streakType: { userId, streakType } },
    create: { userId, streakType, currentCount: 1, bestCount: 1, lastIncrementAt: new Date() },
    update: {
      currentCount: { increment: 1 },
      lastIncrementAt: new Date(),
    },
  });
  // Update bestCount if current exceeds it
  if (streak.currentCount > streak.bestCount) {
    await db.badgeStreak.update({
      where: { id: streak.id },
      data: { bestCount: streak.currentCount },
    });
  }
  return streak.currentCount;
}

async function resetStreak(userId: string, streakType: string): Promise<void> {
  await db.badgeStreak.upsert({
    where: { userId_streakType: { userId, streakType } },
    create: { userId, streakType, currentCount: 0, bestCount: 0, lastResetAt: new Date() },
    update: { currentCount: 0, lastResetAt: new Date() },
  });
}

async function getStreakCount(userId: string, streakType: string): Promise<number> {
  const streak = await db.badgeStreak.findUnique({
    where: { userId_streakType: { userId, streakType } },
  });
  return streak?.currentCount ?? 0;
}

// ── Rule Definitions ────────────────────────────────────

const RIVALRY_OPPONENTS = ["Minnesota", "Iowa", "Ohio State", "Michigan", "Nebraska"];

const rules: BadgeRule[] = [
  // ── Gear & Checkout ─────────────────────────────────

  {
    slug: "first-checkout",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
      });
      return count >= 1;
    },
  },
  {
    slug: "gear-head",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
      });
      return count >= 50;
    },
  },
  {
    slug: "century-club",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
      });
      return count >= 100;
    },
  },
  {
    slug: "clean-slate",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await getStreakCount(userId, "on-time-returns");
      return count >= 10;
    },
  },
  {
    slug: "speed-scan",
    triggers: ["checkout_scan_completed"],
    evaluate: async (userId) => {
      const fastSession = await db.scanSession.findFirst({
        where: {
          actorUserId: userId,
          phase: "CHECKOUT",
          status: "COMPLETED",
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
      });
      if (!fastSession || !fastSession.completedAt) return false;
      const durationMs = fastSession.completedAt.getTime() - fastSession.startedAt.getTime();
      return durationMs < 60_000;
    },
  },
  {
    slug: "full-send",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      // Find any booking with 10+ total items
      const bookings = await db.booking.findMany({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
        include: {
          serializedItems: { select: { id: true } },
          bulkItems: { select: { checkedOutQuantity: true, plannedQuantity: true } },
        },
      });
      return bookings.some((b) => {
        const serialCount = b.serializedItems.length;
        const bulkCount = b.bulkItems.reduce(
          (sum, item) => sum + (item.checkedOutQuantity ?? item.plannedQuantity),
          0
        );
        return serialCount + bulkCount >= 10;
      });
    },
  },
  {
    slug: "zero-loss",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      // Count bulk check-in movements by this user where quantity matches
      const movements = await db.bulkStockMovement.count({
        where: { actorUserId: userId, kind: "CHECKIN" },
      });
      return movements >= 50;
    },
  },
  {
    slug: "lens-hog",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
        include: {
          serializedItems: {
            include: { asset: { include: { category: true } } },
          },
        },
      });
      return bookings.some((b) => {
        const lensCount = b.serializedItems.filter(
          (item) => item.asset.category?.name?.toLowerCase().includes("lens")
        ).length;
        return lensCount >= 5;
      });
    },
  },
  {
    slug: "battery-pack",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
        include: {
          bulkItems: { include: { bulkSku: true } },
        },
      });
      return bookings.some((b) => {
        const batteryCount = b.bulkItems
          .filter((item) => item.bulkSku.category?.toLowerCase().includes("batter"))
          .reduce((sum, item) => sum + (item.checkedOutQuantity ?? item.plannedQuantity), 0);
        return batteryCount >= 10;
      });
    },
  },

  // ── Shift & Scheduling ──────────────────────────────

  {
    slug: "shift-starter",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const count = await db.shiftAssignment.count({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
      });
      return count >= 1;
    },
  },
  {
    slug: "iron-worker",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const count = await db.shiftAssignment.count({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
      });
      return count >= 50;
    },
  },
  {
    slug: "centurion",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const count = await db.shiftAssignment.count({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
      });
      return count >= 100;
    },
  },
  {
    slug: "trade-hero",
    triggers: ["shift_trade_completed"],
    evaluate: async (userId) => {
      const count = await db.shiftTrade.count({
        where: { claimedByUserId: userId, status: "COMPLETED" },
      });
      return count >= 5;
    },
  },
  {
    slug: "four-corners",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const assignments = await db.shiftAssignment.findMany({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
        include: { shift: { select: { area: true } } },
      });
      const areas = new Set(assignments.map((a) => a.shift.area));
      return areas.size >= 4;
    },
  },
  {
    slug: "weekend-warrior",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const assignments = await db.shiftAssignment.findMany({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
        include: { shift: { select: { startsAt: true } } },
      });
      const weekendCount = assignments.filter((a) => {
        const day = a.shift.startsAt.getDay();
        return day === 0 || day === 6;
      }).length;
      return weekendCount >= 10;
    },
  },
  {
    slug: "double-header",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const assignments = await db.shiftAssignment.findMany({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
        include: { shift: { select: { startsAt: true } } },
      });
      const dateMap = new Map<string, number>();
      for (const a of assignments) {
        const dateKey = a.shift.startsAt.toISOString().slice(0, 10);
        dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
      }
      return Array.from(dateMap.values()).some((count) => count >= 2);
    },
  },
  {
    slug: "swiss-army-knife",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const assignments = await db.shiftAssignment.findMany({
        where: { userId, status: { in: ["APPROVED", "COMPLETED"] } },
        include: {
          shift: {
            include: {
              shiftGroup: {
                include: { event: { select: { sportCode: true, startsAt: true } } },
              },
            },
          },
        },
      });
      // Group by month, count distinct sports
      const monthSports = new Map<string, Set<string>>();
      for (const a of assignments) {
        const sportCode = a.shift.shiftGroup?.event?.sportCode;
        if (!sportCode) continue;
        const monthKey = a.shift.startsAt.toISOString().slice(0, 7);
        if (!monthSports.has(monthKey)) monthSports.set(monthKey, new Set());
        monthSports.get(monthKey)!.add(sportCode);
      }
      return Array.from(monthSports.values()).some((sports) => sports.size >= 3);
    },
  },

  // ── Event & Sports Coverage ─────────────────────────

  {
    slug: "game-day-ready",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT", eventId: { not: null } },
      });
      return count >= 1;
    },
  },
  {
    slug: "all-sport-athlete",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          eventId: { not: null },
        },
        include: { event: { select: { sportCode: true } } },
      });
      const sports = new Set(bookings.map((b) => b.event?.sportCode).filter(Boolean));
      return sports.size >= 5;
    },
  },
  {
    slug: "road-warrior",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          event: { isHome: false },
        },
      });
      return count >= 5;
    },
  },
  {
    slug: "rivalry-week",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          event: { opponent: { in: RIVALRY_OPPONENTS } },
        },
      });
      return count >= 1;
    },
  },
  {
    slug: "march-madness",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          event: { sportCode: { contains: "basketball", mode: "insensitive" } },
        },
        include: { event: { select: { startsAt: true } } },
      });
      return bookings.some((b) => {
        if (!b.event) return false;
        const month = b.event.startsAt.getMonth(); // 0-indexed
        return month === 2 || month === 3; // March or April
      });
    },
  },
  {
    slug: "camp-randall-regular",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          event: { location: { name: { contains: "Camp Randall", mode: "insensitive" } } },
        },
      });
      return count >= 10;
    },
  },
  {
    slug: "season-ticket",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      // Get all event-linked bookings grouped by sport + season year
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          eventId: { not: null },
        },
        include: { event: { select: { sportCode: true, isHome: true, startsAt: true } } },
      });

      // Group covered home events by sport+year
      const sportYearEvents = new Map<string, Set<string>>();
      for (const b of bookings) {
        if (!b.event?.sportCode || b.event.isHome !== true) continue;
        const year = b.event.startsAt.getFullYear();
        const key = `${b.event.sportCode}-${year}`;
        if (!sportYearEvents.has(key)) sportYearEvents.set(key, new Set());
        sportYearEvents.get(key)!.add(b.eventId!);
      }

      // Check if any sport+year has all home events covered
      for (const [key, coveredIds] of sportYearEvents) {
        const [sportCode, yearStr] = key.split("-");
        const year = parseInt(yearStr);
        const totalHomeEvents = await db.calendarEvent.count({
          where: {
            sportCode,
            isHome: true,
            startsAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
          },
        });
        if (totalHomeEvents > 0 && coveredIds.size >= totalHomeEvents) return true;
      }
      return false;
    },
  },
  {
    slug: "buckys-favorite",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT", eventId: { not: null } },
      });
      return count >= 25;
    },
  },
  {
    slug: "hat-trick",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          eventId: { not: null },
        },
        include: { event: { select: { startsAt: true } } },
      });
      // Check if 3 distinct event dates fall within any 7-day window
      const dates = bookings
        .map((b) => b.event?.startsAt)
        .filter(Boolean)
        .map((d) => d!.getTime())
        .sort((a, b) => a - b);
      for (let i = 0; i <= dates.length - 3; i++) {
        if (dates[i + 2] - dates[i] <= 7 * 24 * 60 * 60 * 1000) return true;
      }
      return false;
    },
  },
  {
    slug: "back-to-back",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          eventId: { not: null },
        },
        include: { event: { select: { startsAt: true } } },
      });
      const dates = bookings
        .map((b) => b.event?.startsAt?.toISOString().slice(0, 10))
        .filter(Boolean) as string[];
      const dateSet = new Set(dates);
      for (const d of dateSet) {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        if (dateSet.has(next.toISOString().slice(0, 10))) return true;
      }
      return false;
    },
  },

  // ── Accountability ──────────────────────────────────

  {
    slug: "ironclad",
    triggers: ["shift_approved"],
    evaluate: async (userId) => {
      const count = await getStreakCount(userId, "shift-attendance");
      return count >= 20;
    },
  },
  {
    slug: "trusted-hands",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const bookings = await db.booking.findMany({
        where: { requesterUserId: userId, status: "COMPLETED", kind: "CHECKOUT" },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { startsAt: true, endsAt: true, updatedAt: true },
      });
      if (bookings.length < 25) return false;
      // All 25 must be on-time (completed before or on endsAt)
      return bookings.every((b) => b.updatedAt <= b.endsAt);
    },
  },
  {
    slug: "unbreakable",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await getStreakCount(userId, "on-time-returns");
      return count >= 30;
    },
  },
  {
    slug: "full-accountability",
    triggers: ["badge_earned"],
    evaluate: async (userId) => {
      const required = ["clean-slate", "ironclad", "trusted-hands"];
      const earned = await db.studentBadge.findMany({
        where: { userId },
        include: { badge: { select: { slug: true } } },
      });
      const earnedSlugs = new Set(earned.map((e) => e.badge.slug));
      return required.every((s) => earnedSlugs.has(s));
    },
  },
  {
    slug: "the-vault",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      // Check current academic year (Sept to May)
      const now = new Date();
      const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(`${year}-09-01`);
      const end = new Date(`${year + 1}-05-31`);

      // Any overdue booking in the window?
      const overdueCount = await db.booking.count({
        where: {
          requesterUserId: userId,
          kind: "CHECKOUT",
          status: "COMPLETED",
          updatedAt: { gte: start, lte: end },
          endsAt: { lt: new Date() },
          // overdue = updatedAt > endsAt (completed after due)
        },
      });

      // Check each booking individually for overdue
      if (overdueCount > 0) {
        const bookings = await db.booking.findMany({
          where: {
            requesterUserId: userId,
            kind: "CHECKOUT",
            status: "COMPLETED",
            updatedAt: { gte: start, lte: end },
          },
          select: { endsAt: true, updatedAt: true },
        });
        const hasOverdue = bookings.some((b) => b.updatedAt > b.endsAt);
        if (hasOverdue) return false;
      }

      // Must have at least some activity
      const totalInWindow = await db.booking.count({
        where: {
          requesterUserId: userId,
          kind: "CHECKOUT",
          status: "COMPLETED",
          updatedAt: { gte: start, lte: end },
        },
      });
      return totalInWindow >= 5;
    },
  },

  // ── Secret / Easter Egg ─────────────────────────────

  {
    slug: "perfectionist",
    triggers: ["checkout_scan_completed", "checkin_scan_completed"],
    evaluate: async (userId) => {
      const count = await getStreakCount(userId, "scan-accuracy");
      return count >= 50;
    },
  },
  {
    slug: "ghost",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const now = new Date();
      const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const semesterStart = new Date(`${year}-09-01`);
      const bookings = await db.booking.findMany({
        where: {
          requesterUserId: userId,
          kind: "CHECKOUT",
          status: "COMPLETED",
          updatedAt: { gte: semesterStart },
        },
        select: { endsAt: true, updatedAt: true },
      });
      if (bookings.length < 5) return false; // need meaningful activity
      return bookings.every((b) => b.updatedAt <= b.endsAt);
    },
  },
  {
    slug: "the-closer",
    triggers: ["checkin_scan_completed"],
    evaluate: async (userId) => {
      // Find events where this user had the latest check-in scan session
      const sessions = await db.scanSession.findMany({
        where: {
          actorUserId: userId,
          phase: "CHECKIN",
          status: "COMPLETED",
        },
        include: {
          booking: { select: { eventId: true } },
        },
      });

      let closerCount = 0;
      const checkedEvents = new Set<string>();

      for (const session of sessions) {
        const eventId = session.booking?.eventId;
        if (!eventId || checkedEvents.has(eventId)) continue;
        checkedEvents.add(eventId);

        // Find the latest checkin scan session for this event
        const latestForEvent = await db.scanSession.findFirst({
          where: {
            phase: "CHECKIN",
            status: "COMPLETED",
            booking: { eventId },
          },
          orderBy: { completedAt: "desc" },
        });

        if (latestForEvent?.actorUserId === userId) closerCount++;
      }
      return closerCount >= 20;
    },
  },
  {
    slug: "og",
    triggers: ["booking_completed", "shift_approved"],
    evaluate: async (userId) => {
      const first10 = await db.user.findMany({
        where: { role: "STUDENT" },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { id: true },
      });
      return first10.some((u) => u.id === userId);
    },
  },
  {
    slug: "night-owl",
    triggers: ["checkin_scan_completed"],
    evaluate: async (userId) => {
      const sessions = await db.scanSession.findMany({
        where: {
          actorUserId: userId,
          phase: "CHECKIN",
          status: "COMPLETED",
          completedAt: { not: null },
        },
      });
      const lateCount = sessions.filter((s) => {
        if (!s.completedAt) return false;
        return s.completedAt.getHours() >= 21;
      }).length;
      return lateCount >= 5;
    },
  },
  {
    slug: "early-bird",
    triggers: ["checkout_scan_completed"],
    evaluate: async (userId) => {
      const sessions = await db.scanSession.findMany({
        where: {
          actorUserId: userId,
          phase: "CHECKOUT",
          status: "COMPLETED",
        },
      });
      const earlyCount = sessions.filter((s) => s.startedAt.getHours() < 7).length;
      return earlyCount >= 5;
    },
  },
  {
    slug: "jump-around",
    triggers: ["booking_completed"],
    evaluate: async (userId) => {
      const count = await db.booking.count({
        where: {
          requesterUserId: userId,
          status: "COMPLETED",
          kind: "CHECKOUT",
          event: {
            sportCode: { contains: "football", mode: "insensitive" },
            location: { name: { contains: "Camp Randall", mode: "insensitive" } },
          },
        },
      });
      return count >= 1;
    },
  },
  {
    slug: "freshman-year",
    triggers: ["badge_earned"],
    evaluate: async (userId) => {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      });
      if (!user) return false;
      const cutoff = new Date(user.createdAt.getTime() + 60 * 24 * 60 * 60 * 1000);
      const earlyBadges = await db.studentBadge.count({
        where: { userId, earnedAt: { lte: cutoff } },
      });
      return earlyBadges >= 5;
    },
  },
  // Note: "snow-day" and "steward" are omitted for V1 — they require
  // external weather API and equipment issue reporting (Slice 6) respectively.
];

// ── Build lookup index ──────────────────────────────────

const rulesByTrigger = new Map<BadgeTrigger, BadgeRule[]>();
for (const rule of rules) {
  for (const trigger of rule.triggers) {
    if (!rulesByTrigger.has(trigger)) rulesByTrigger.set(trigger, []);
    rulesByTrigger.get(trigger)!.push(rule);
  }
}

// ── Main Evaluation Entry Point ─────────────────────────

export async function evaluateBadges(
  userId: string,
  trigger: BadgeTrigger,
  ctx: TriggerContext = {}
): Promise<string[]> {
  const candidateRules = rulesByTrigger.get(trigger) ?? [];
  if (candidateRules.length === 0) return [];

  // Get already-earned badge slugs for this user
  const earned = await db.studentBadge.findMany({
    where: { userId },
    include: { badge: { select: { slug: true } } },
  });
  const earnedSlugs = new Set(earned.map((e) => e.badge.slug));

  const newlyEarned: string[] = [];

  for (const rule of candidateRules) {
    if (earnedSlugs.has(rule.slug)) continue;

    try {
      const qualifies = await rule.evaluate(userId, ctx);
      if (!qualifies) continue;

      // Look up badge definition
      const badge = await db.badgeDefinition.findUnique({
        where: { slug: rule.slug },
      });
      if (!badge) continue;

      // Award the badge
      await db.studentBadge.create({
        data: { userId, badgeId: badge.id },
      });

      newlyEarned.push(rule.slug);
      earnedSlugs.add(rule.slug);
    } catch (error) {
      // Badge evaluation should never break the main flow
      console.error(`Badge evaluation error for ${rule.slug}:`, error);
    }
  }

  // If any badges were earned, check composite badges
  if (newlyEarned.length > 0) {
    const compositeBadges = await evaluateBadges(userId, "badge_earned", ctx);
    newlyEarned.push(...compositeBadges);
  }

  return newlyEarned;
}

// ── Streak Management (called from route handlers) ──────

export async function handleOnTimeReturn(userId: string): Promise<void> {
  await incrementStreak(userId, "on-time-returns");
}

export async function handleOverdueReturn(userId: string): Promise<void> {
  await resetStreak(userId, "on-time-returns");
  // Also revoke streak-dependent badges that require continuous streaks
  // (Clean Slate and Unbreakable are re-earnable after streak rebuilds)
}

export async function handleShiftCompleted(userId: string): Promise<void> {
  await incrementStreak(userId, "shift-attendance");
}

export async function handleShiftNoShow(userId: string): Promise<void> {
  await resetStreak(userId, "shift-attendance");
}

export async function handleSuccessfulScan(userId: string): Promise<void> {
  await incrementStreak(userId, "scan-accuracy");
}

export async function handleFailedScan(userId: string): Promise<void> {
  await resetStreak(userId, "scan-accuracy");
}
