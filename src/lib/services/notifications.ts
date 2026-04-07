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
      },
      take: 500, // Process in bounded batches to prevent memory issues
      orderBy: { endsAt: "asc" }, // Most overdue first
    }),
    db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true }
    }),
  ]);

  if (openCheckouts.length === 0) {
    return { scanned: 0, notificationsCreated: 0 };
  }

  // Batch-fetch existing dedupeKeys for relevant bookings only (not entire table)
  const bookingIds = openCheckouts.map((c) => c.id);
  const existingNotifications = await db.notification.findMany({
    where: {
      dedupeKey: { not: null },
      OR: bookingIds.map((id) => ({ dedupeKey: { startsWith: id } })),
    },
    select: { dedupeKey: true },
  }).then(
    (rows) => new Set(rows.map((r) => r.dedupeKey).filter(Boolean)),
    () => new Set<string>()
  );

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
          try {
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
          } catch (err) {
            console.error(`[NOTIFY] Failed to create notification for checkout ${checkout.id}, rule ${rule.type}:`, err);
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
          try {
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
          } catch (err) {
            console.error(`[NOTIFY] Failed to create admin notification for checkout ${checkout.id}, admin ${admin.id}:`, err);
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

/**
 * Creates a "Gear Up" notification for a student when they are assigned/approved for a shift.
 * Skips if a notification for this assignment already exists (deduped).
 */
export async function createShiftGearUpNotification(assignmentId: string): Promise<void> {
  const assignment = await db.shiftAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      user: { select: { id: true, email: true } },
      shift: {
        include: {
          shiftGroup: {
            include: {
              event: {
                select: {
                  id: true,
                  summary: true,
                  startsAt: true,
                  sportCode: true,
                  opponent: true,
                  isHome: true,
                  locationId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment) return;

  const event = assignment.shift.shiftGroup.event;
  const dedupeKey = `shift:${assignmentId}:gear_up`;

  // Check for existing notification
  const existing = await db.notification.findUnique({ where: { dedupeKey } });
  if (existing) return;

  const eventTitle = event.opponent
    ? `${event.isHome ? "vs" : "at"} ${event.opponent}`
    : event.summary;

  const shiftTime = new Date(assignment.shift.startsAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const title = "Gear up for your shift";
  const body = `You're assigned to ${assignment.shift.area} for ${eventTitle} at ${shiftTime}. Reserve your gear now.`;

  try {
    await db.notification.create({
      data: {
        userId: assignment.userId,
        type: "shift_gear_up",
        title,
        body,
        payload: {
          assignmentId: assignment.id,
          shiftId: assignment.shiftId,
          eventId: event.id,
          eventSummary: event.summary,
          area: assignment.shift.area,
          startsAt: assignment.shift.startsAt.toISOString(),
          sportCode: event.sportCode,
          locationId: event.locationId,
        },
        channel: "IN_APP",
        sentAt: new Date(),
        dedupeKey,
      },
    });

    // Also send email notification
    if (assignment.user.email) {
      await sendEmail({
        to: assignment.user.email,
        subject: title,
        html: buildNotificationEmail({
          title,
          body,
          bookingTitle: event.summary,
          dueAt: assignment.shift.startsAt.toISOString(),
        }),
      });
    }
  } catch (err) {
    console.error(`[NOTIFY] Failed to create shift gear-up notification for assignment ${assignmentId}:`, err);
  }
}

/**
 * Notifies all ADMIN and STAFF users when a student reports an item as damaged or lost
 * during check-in scanning.
 */
export async function notifyItemReport(args: {
  bookingId: string;
  bookingTitle: string;
  assetId: string;
  assetTag: string;
  itemDescription: string;
  reportType: "DAMAGED" | "LOST";
  damageDescription?: string;
  reporterName: string;
}): Promise<void> {
  const supervisors = await db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, active: true },
    select: { id: true, email: true },
  });

  const now = new Date();
  const typeLower = args.reportType.toLowerCase();
  const notifType = `checkin_item_${typeLower}`;
  const title = `Item reported ${typeLower}: ${args.assetTag}`;
  const body = args.reportType === "DAMAGED"
    ? `${args.reporterName} reported ${args.itemDescription} (${args.assetTag}) as damaged during check-in of "${args.bookingTitle}".${args.damageDescription ? ` Description: ${args.damageDescription}` : ""}`
    : `${args.reporterName} reported ${args.itemDescription} (${args.assetTag}) as lost during check-in of "${args.bookingTitle}".`;

  // Batch-create all notifications in one INSERT
  const notifData = supervisors.map((s) => ({
    userId: s.id,
    type: notifType,
    title,
    body,
    payload: {
      bookingId: args.bookingId,
      bookingTitle: args.bookingTitle,
      assetId: args.assetId,
      assetTag: args.assetTag,
      reportType: args.reportType,
      reporterName: args.reporterName,
    },
    channel: "IN_APP" as const,
    sentAt: now,
    dedupeKey: `${args.bookingId}:item_report:${args.assetId}:${s.id}`,
  }));

  try {
    await db.notification.createMany({ data: notifData, skipDuplicates: true });
  } catch (err) {
    console.error(`[NOTIFY] Failed to batch-create item report notifications:`, err);
  }

  // Send emails concurrently (fire-and-forget, failures don't block)
  const emailPromises = supervisors
    .filter((s) => s.email)
    .map((s) =>
      sendEmail({
        to: s.email!,
        subject: title,
        html: buildNotificationEmail({
          title,
          body,
          bookingTitle: args.bookingTitle,
          dueAt: now.toISOString(),
        }),
      }).catch((err) =>
        console.error(`[NOTIFY] Failed to send item report email to ${s.email}:`, err)
      )
    );
  await Promise.allSettled(emailPromises);
}

/**
 * Notifies all ADMIN users when a bulk SKU stock drops to or below its min threshold.
 * Deduped: only one notification per SKU per 24 hours.
 */
export async function notifyLowStock(args: {
  bulkSkuId: string;
  skuName: string;
  onHandQuantity: number;
  minThreshold: number;
}) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });

  if (admins.length === 0) return;

  const now = new Date();
  const title = `Low stock: ${args.skuName}`;
  const body = `${args.onHandQuantity} remaining (threshold: ${args.minThreshold}). Restock soon.`;

  // Pre-fetch all recent dedup keys in one query instead of N individual findFirst calls
  const dedupeKeys = admins.map((a) => `low_stock:${args.bulkSkuId}:${a.id}`);
  const recentNotifs = await db.notification.findMany({
    where: {
      dedupeKey: { in: dedupeKeys },
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { dedupeKey: true },
  });
  const recentKeys = new Set(recentNotifs.map((n) => n.dedupeKey));

  // Batch-create notifications for admins that haven't been notified recently
  const notifData = admins
    .filter((a) => !recentKeys.has(`low_stock:${args.bulkSkuId}:${a.id}`))
    .map((a) => ({
      userId: a.id,
      type: "low_stock",
      title,
      body,
      payload: {
        bulkSkuId: args.bulkSkuId,
        skuName: args.skuName,
        onHandQuantity: args.onHandQuantity,
        minThreshold: args.minThreshold,
      },
      channel: "IN_APP" as const,
      sentAt: now,
      dedupeKey: `low_stock:${args.bulkSkuId}:${a.id}`,
    }));

  if (notifData.length > 0) {
    try {
      await db.notification.createMany({ data: notifData, skipDuplicates: true });
    } catch (err) {
      console.error(`[NOTIFY] Failed to batch-create low-stock notifications:`, err);
    }
  }
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
