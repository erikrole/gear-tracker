import { db } from "@/lib/db";
import { sendEmail, buildNotificationEmail } from "@/lib/email";

/**
 * Fallback escalation schedule used when no DB rules exist.
 */
const DEFAULT_SCHEDULE = [
  { hoursFromDue: -4, type: "checkout_due_reminder", title: "Checkout due in 4 hours", notifyRequester: true, notifyAdmins: false },
  { hoursFromDue: 0, type: "checkout_due_now", title: "Checkout is due now", notifyRequester: true, notifyAdmins: false },
  { hoursFromDue: 2, type: "checkout_overdue_2h", title: "Checkout is 2 hours overdue", notifyRequester: true, notifyAdmins: false },
  { hoursFromDue: 24, type: "checkout_overdue_24h", title: "Checkout is 24 hours overdue", notifyRequester: true, notifyAdmins: true }
];

async function getEscalationRules() {
  const rules = await db.escalationRule.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  return rules.length > 0 ? rules : DEFAULT_SCHEDULE;
}

async function getMaxNotificationsPerBooking(): Promise<number> {
  const config = await db.systemConfig.findUnique({ where: { key: "escalation" } });
  const value = config?.value as { maxNotificationsPerBooking?: number } | null;
  return value?.maxNotificationsPerBooking ?? 10;
}

/**
 * Scans all open checkouts and creates notification records for any that
 * match the escalation schedule. Uses dedupeKey to prevent duplicates.
 * Enforces per-booking notification cap from SystemConfig.
 */
export async function processOverdueNotifications(): Promise<{
  scanned: number;
  notificationsCreated: number;
}> {
  const now = new Date();
  const rules = await getEscalationRules();
  const maxPerBooking = await getMaxNotificationsPerBooking();

  const [openCheckouts, admins] = await Promise.all([
    db.booking.findMany({
      where: { kind: "CHECKOUT", status: "OPEN" },
      include: {
        requester: { select: { id: true, name: true, email: true } }
      }
    }),
    db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true }
    }),
  ]);

  if (openCheckouts.length === 0) {
    return { scanned: 0, notificationsCreated: 0 };
  }

  // Batch-fetch all existing dedupeKeys to avoid N+1 lookups
  const bookingIds = openCheckouts.map((c) => c.id);
  const [existingNotifications, notifCounts] = await Promise.all([
    db.notification.findMany({
      where: { dedupeKey: { startsWith: "" } },
      select: { dedupeKey: true },
    }).then((rows) => new Set(rows.map((r) => r.dedupeKey).filter(Boolean))),
    db.notification.groupBy({
      by: ["userId"],
      where: {
        payload: { path: ["bookingId"], string_contains: "" },
      },
      _count: { id: true },
    }),
  ]).catch(() => [new Set<string>(), []] as const);

  // Build per-booking notification count from payload.bookingId
  // Since JSON filtering with groupBy is tricky, fall back to batch count
  const bookingNotifCounts = new Map<string, number>();
  const countRows = await db.notification.findMany({
    where: {
      OR: bookingIds.map((id) => ({
        payload: { path: ["bookingId"], equals: id }
      }))
    },
    select: { payload: true }
  });
  for (const row of countRows) {
    const bid = (row.payload as Record<string, string>)?.bookingId;
    if (bid) bookingNotifCounts.set(bid, (bookingNotifCounts.get(bid) ?? 0) + 1);
  }

  let notificationsCreated = 0;

  for (const checkout of openCheckouts) {
    const dueAt = new Date(checkout.endsAt);
    const existingCount = bookingNotifCounts.get(checkout.id) ?? 0;
    if (existingCount >= maxPerBooking) continue;

    let localCreated = 0;

    for (const rule of rules) {
      const triggerTime = new Date(dueAt.getTime() + rule.hoursFromDue * 3600_000);
      if (now < triggerTime) continue;
      if (existingCount + localCreated >= maxPerBooking) break;

      if (rule.notifyRequester) {
        const dedupeKey = `${checkout.id}:${rule.type}`;
        if (!existingNotifications.has(dedupeKey)) {
          const body = `"${checkout.title}" was due ${formatRelative(dueAt, now)}. Please return items.`;
          await db.notification.create({
            data: {
              userId: checkout.requesterUserId,
              type: rule.type,
              title: rule.title,
              body,
              payload: {
                bookingId: checkout.id,
                bookingTitle: checkout.title,
                dueAt: dueAt.toISOString()
              },
              channel: "IN_APP",
              sentAt: now,
              dedupeKey
            }
          });
          existingNotifications.add(dedupeKey);
          localCreated += 1;

          if (checkout.requester.email) {
            await sendEmail({
              to: checkout.requester.email,
              subject: rule.title,
              html: buildNotificationEmail({
                title: rule.title,
                body,
                bookingTitle: checkout.title,
                dueAt: dueAt.toISOString(),
              }),
            });
          }
        }
      }

      // Admin escalation
      if (rule.notifyAdmins) {
        for (const admin of admins) {
          if (admin.id === checkout.requesterUserId) continue;

          const adminDedupeKey = `${checkout.id}:${rule.type}:admin:${admin.id}`;
          if (existingNotifications.has(adminDedupeKey)) continue;

          const adminBody = `${checkout.requester.name}'s checkout "${checkout.title}" is over ${rule.hoursFromDue} hours overdue.`;
          await db.notification.create({
            data: {
              userId: admin.id,
              type: rule.type,
              title: `Overdue: ${checkout.title}`,
              body: adminBody,
              payload: {
                bookingId: checkout.id,
                bookingTitle: checkout.title,
                requesterName: checkout.requester.name,
                dueAt: dueAt.toISOString()
              },
              channel: "IN_APP",
              sentAt: now,
              dedupeKey: adminDedupeKey
            }
          });
          existingNotifications.add(adminDedupeKey);
          localCreated += 1;

          if (admin.email) {
            await sendEmail({
              to: admin.email,
              subject: `Overdue: ${checkout.title}`,
              html: buildNotificationEmail({
                title: `Overdue: ${checkout.title}`,
                body: adminBody,
                bookingTitle: checkout.title,
                dueAt: dueAt.toISOString(),
              }),
            });
          }
        }
      }
    }

    notificationsCreated += localCreated;
  }

  return {
    scanned: openCheckouts.length,
    notificationsCreated
  };
}

function formatRelative(dueAt: Date, now: Date): string {
  const diffMs = now.getTime() - dueAt.getTime();
  if (diffMs < 0) {
    const hours = Math.round(-diffMs / 3600_000);
    return hours <= 1 ? "in less than an hour" : `in ${hours} hours`;
  }
  const hours = Math.round(diffMs / 3600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
