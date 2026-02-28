import { db } from "@/lib/db";

/**
 * Overdue notification escalation schedule.
 * Each entry defines a trigger relative to the booking's endsAt.
 * Negative hours = before due, positive = after due.
 */
const ESCALATION_SCHEDULE = [
  { hoursFromDue: -4, type: "checkout_due_reminder", title: "Checkout due in 4 hours" },
  { hoursFromDue: 0, type: "checkout_due_now", title: "Checkout is due now" },
  { hoursFromDue: 2, type: "checkout_overdue_2h", title: "Checkout is 2 hours overdue" },
  { hoursFromDue: 24, type: "checkout_overdue_24h", title: "Checkout is 24 hours overdue" }
] as const;

/**
 * Scans all open checkouts and creates notification records for any that
 * match the escalation schedule. Uses dedupeKey to prevent duplicates.
 *
 * In dev mode, "emails" are logged to console. In production, this would
 * send via SMTP (configured via env vars).
 */
export async function processOverdueNotifications(): Promise<{
  scanned: number;
  notificationsCreated: number;
}> {
  const now = new Date();

  // Find all open checkouts
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

    for (const trigger of ESCALATION_SCHEDULE) {
      const triggerTime = new Date(dueAt.getTime() + trigger.hoursFromDue * 3600_000);

      // Only fire if trigger time has passed
      if (now < triggerTime) continue;

      const dedupeKey = `${checkout.id}:${trigger.type}`;

      // Check if already sent (dedupe)
      const existing = await db.notification.findUnique({
        where: { dedupeKey }
      });
      if (existing) continue;

      // Create in-app notification for the requester
      const body = `"${checkout.title}" was due ${formatRelative(dueAt, now)}. Please return items.`;

      await db.notification.create({
        data: {
          userId: checkout.requesterUserId,
          type: trigger.type,
          title: trigger.title,
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

      // For the 24h overdue trigger, also notify managers/admins
      if (trigger.hoursFromDue === 24) {
        const admins = await db.user.findMany({
          where: { role: { in: ["ADMIN", "STAFF"] } },
          select: { id: true }
        });

        for (const admin of admins) {
          if (admin.id === checkout.requesterUserId) continue;

          const adminDedupeKey = `${checkout.id}:${trigger.type}:admin:${admin.id}`;
          const existingAdmin = await db.notification.findUnique({
            where: { dedupeKey: adminDedupeKey }
          });
          if (existingAdmin) continue;

          await db.notification.create({
            data: {
              userId: admin.id,
              type: trigger.type,
              title: `Overdue: ${checkout.title}`,
              body: `${checkout.requester.name}'s checkout "${checkout.title}" is over 24 hours overdue.`,
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

        // Dev mode: log email instead of sending
        console.log(
          `[EMAIL] Overdue 24h: "${checkout.title}" by ${checkout.requester.name} ` +
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
