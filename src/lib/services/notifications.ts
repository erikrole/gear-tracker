import { db } from "@/lib/db";

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

  const openCheckouts = await db.booking.findMany({
    where: {
      kind: "CHECKOUT",
      status: "OPEN"
    },
    include: {
      requester: { select: { id: true, name: true, email: true } }
    }
  });

  let notificationsCreated = 0;

  for (const checkout of openCheckouts) {
    const dueAt = new Date(checkout.endsAt);

    // Per-booking cap check
    const existingCount = await db.notification.count({
      where: {
        payload: { path: ["bookingId"], equals: checkout.id }
      }
    });
    if (existingCount >= maxPerBooking) continue;

    for (const rule of rules) {
      const triggerTime = new Date(dueAt.getTime() + rule.hoursFromDue * 3600_000);
      if (now < triggerTime) continue;

      // Re-check cap after each notification created
      if (existingCount + notificationsCreated >= maxPerBooking) break;

      if (rule.notifyRequester) {
        const dedupeKey = `${checkout.id}:${rule.type}`;
        const existing = await db.notification.findUnique({ where: { dedupeKey } });

        if (!existing) {
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
          notificationsCreated += 1;
        }
      }

      // Admin escalation
      if (rule.notifyAdmins) {
        const admins = await db.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true }
        });

        for (const admin of admins) {
          if (admin.id === checkout.requesterUserId) continue;

          const adminDedupeKey = `${checkout.id}:${rule.type}:admin:${admin.id}`;
          const existingAdmin = await db.notification.findUnique({
            where: { dedupeKey: adminDedupeKey }
          });
          if (existingAdmin) continue;

          await db.notification.create({
            data: {
              userId: admin.id,
              type: rule.type,
              title: `Overdue: ${checkout.title}`,
              body: `${checkout.requester.name}'s checkout "${checkout.title}" is over ${rule.hoursFromDue} hours overdue.`,
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
          notificationsCreated += 1;
        }

        console.log(
          `[EMAIL] Overdue ${rule.hoursFromDue}h: "${checkout.title}" by ${checkout.requester.name} ` +
          `(${checkout.requester.email}), due ${dueAt.toISOString()}`
        );
      }
    }
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
