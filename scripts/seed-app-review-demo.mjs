import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  AllocationKind,
  BookingKind,
  BookingStatus,
  BulkMovementKind,
  BulkUnitStatus,
  NotificationChannel,
  PrismaClient,
  Role,
  ShiftArea,
  ShiftAssignmentStatus,
  ShiftWorkerType,
} from "@prisma/client";

const confirmation = process.env.APP_REVIEW_DEMO_SEED;
if (confirmation !== "confirm") {
  console.error("Refusing to seed App Review demo data. Set APP_REVIEW_DEMO_SEED=confirm.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL ?? "";
const prisma = connectionString.includes(".neon.tech")
  ? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
  : new PrismaClient();

const password = process.env.APP_REVIEW_DEMO_PASSWORD || "ReviewDemo!2026";

const ids = {
  location: "demo-location-app-review",
  department: "demo-department-creative",
  cameraCategory: "demo-category-cameras",
  lensCategory: "demo-category-lenses",
  audioCategory: "demo-category-audio",
  supportCategory: "demo-category-support",
  reviewer: "demo-user-app-review",
  staffJordan: "demo-user-jordan-lee",
  staffMaya: "demo-user-maya-chen",
  studentAlex: "demo-user-alex-rivera",
  studentSam: "demo-user-sam-patel",
  camera: "demo-asset-camera-001",
  lens: "demo-asset-lens-001",
  audio: "demo-asset-audio-001",
  tripod: "demo-asset-tripod-001",
  batterySku: "demo-bulk-battery-npfz100",
  batteryUnit1: "demo-bulk-battery-npfz100-1",
  batteryUnit2: "demo-bulk-battery-npfz100-2",
  batteryUnit3: "demo-bulk-battery-npfz100-3",
  batteryUnit4: "demo-bulk-battery-npfz100-4",
  eventToday: "demo-event-media-day",
  eventUpcoming: "demo-event-volleyball",
  shiftGroupToday: "demo-shift-group-media-day",
  shiftToday: "demo-shift-video-media-day",
  shiftAssignmentToday: "demo-shift-assignment-reviewer",
  openCheckout: "demo-booking-open-checkout",
  overdueCheckout: "demo-booking-overdue-checkout",
  pendingPickup: "demo-booking-pending-pickup",
  upcomingReservation: "demo-booking-upcoming-reservation",
  completedCheckout: "demo-booking-completed-checkout",
  allowedEmail: "demo-allowed-email-app-review",
};

const userIds = [
  ids.reviewer,
  ids.staffJordan,
  ids.staffMaya,
  ids.studentAlex,
  ids.studentSam,
];
const assetIds = [ids.camera, ids.lens, ids.audio, ids.tripod];
const bookingIds = [
  ids.openCheckout,
  ids.overdueCheckout,
  ids.pendingPickup,
  ids.upcomingReservation,
  ids.completedCheckout,
];
const eventIds = [ids.eventToday, ids.eventUpcoming];
const bulkSkuIds = [ids.batterySku];
const bulkUnitIds = [ids.batteryUnit1, ids.batteryUnit2, ids.batteryUnit3, ids.batteryUnit4];
const categoryIds = [ids.cameraCategory, ids.lensCategory, ids.audioCategory, ids.supportCategory];

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysFromNow(days, hour = 15) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function cleanup(tx) {
  await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
  await tx.favoriteItem.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { assetId: { in: assetIds } }] } });
  await tx.favoriteItemFamily.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { bulkSkuId: { in: bulkSkuIds } }] } });
  await tx.liveActivityToken.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { bookingId: { in: bookingIds } }] } });
  await tx.bulkStockMovement.deleteMany({
    where: { OR: [{ actorUserId: { in: userIds } }, { bookingId: { in: bookingIds } }, { bulkSkuId: { in: bulkSkuIds } }] },
  });
  await tx.scanEvent.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { bookingId: { in: bookingIds } }] } });
  await tx.scanSession.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { bookingId: { in: bookingIds } }] } });
  await tx.shiftTrade.deleteMany({ where: { OR: [{ postedByUserId: { in: userIds } }, { claimedByUserId: { in: userIds } }] } });
  await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await tx.calendarEvent.deleteMany({ where: { id: { in: eventIds } } });
  await tx.bulkStockBalance.deleteMany({ where: { bulkSkuId: { in: bulkSkuIds } } });
  await tx.bulkSkuUnit.deleteMany({ where: { id: { in: bulkUnitIds } } });
  await tx.bulkSku.deleteMany({ where: { id: { in: bulkSkuIds } } });
  await tx.asset.deleteMany({ where: { id: { in: assetIds } } });
  await tx.allowedEmail.deleteMany({ where: { OR: [{ id: ids.allowedEmail }, { email: "appreview@wisconsincreative.com" }] } });
  await tx.user.deleteMany({ where: { id: { in: userIds } } });
  await tx.category.deleteMany({ where: { id: { in: categoryIds } } });
  await tx.department.deleteMany({ where: { id: ids.department } });
  await tx.location.deleteMany({ where: { id: ids.location } });
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await cleanup(tx);

    await tx.location.create({
      data: {
        id: ids.location,
        name: "[DEMO] Creative Checkout Desk",
        address: "1440 Monroe St, Madison, WI",
        isHomeVenue: true,
      },
    });

    await tx.department.create({
      data: {
        id: ids.department,
        name: "[DEMO] Creative Operations",
      },
    });

    await tx.category.createMany({
      data: [
        { id: ids.cameraCategory, name: "[DEMO] Cameras" },
        { id: ids.lensCategory, name: "[DEMO] Lenses" },
        { id: ids.audioCategory, name: "[DEMO] Audio" },
        { id: ids.supportCategory, name: "[DEMO] Support" },
      ],
    });

    await tx.user.createMany({
      data: [
        {
          id: ids.reviewer,
          name: "App Review",
          email: "appreview@wisconsincreative.com",
          passwordHash,
          role: Role.STAFF,
          staffingType: ShiftWorkerType.FT,
          title: "App Reviewer",
          locationId: ids.location,
          wiscardNumber: "DEMOREVIEW001",
          notificationPrefs: { email: true, push: true },
        },
        {
          id: ids.staffJordan,
          name: "Jordan Lee",
          email: "jordan.lee.demo@wisconsincreative.com",
          passwordHash,
          role: Role.STAFF,
          staffingType: ShiftWorkerType.FT,
          title: "Producer",
          locationId: ids.location,
          wiscardNumber: "DEMOJORDAN001",
        },
        {
          id: ids.staffMaya,
          name: "Maya Chen",
          email: "maya.chen.demo@wisconsincreative.com",
          passwordHash,
          role: Role.STAFF,
          staffingType: ShiftWorkerType.FT,
          title: "Photo Editor",
          locationId: ids.location,
          wiscardNumber: "DEMOMAYA001",
        },
        {
          id: ids.studentAlex,
          name: "Alex Rivera",
          email: "alex.rivera.demo@wisconsincreative.com",
          passwordHash,
          role: Role.STUDENT,
          staffingType: ShiftWorkerType.ST,
          primaryArea: ShiftArea.VIDEO,
          locationId: ids.location,
          wiscardNumber: "DEMOALEX001",
          gradYear: 2027,
        },
        {
          id: ids.studentSam,
          name: "Sam Patel",
          email: "sam.patel.demo@wisconsincreative.com",
          passwordHash,
          role: Role.STUDENT,
          staffingType: ShiftWorkerType.ST,
          primaryArea: ShiftArea.PHOTO,
          locationId: ids.location,
          wiscardNumber: "DEMOSAM001",
          gradYear: 2028,
        },
      ],
    });

    await tx.allowedEmail.create({
      data: {
        id: ids.allowedEmail,
        email: "appreview@wisconsincreative.com",
        role: Role.STAFF,
        createdById: ids.reviewer,
        claimedAt: now,
        claimedById: ids.reviewer,
      },
    });

    await tx.studentAreaAssignment.createMany({
      data: [
        { userId: ids.studentAlex, area: ShiftArea.VIDEO, isPrimary: true },
        { userId: ids.studentSam, area: ShiftArea.PHOTO, isPrimary: true },
      ],
    });

    await tx.studentSportAssignment.createMany({
      data: [
        { userId: ids.studentAlex, sportCode: "VB", defaultTraveler: true },
        { userId: ids.studentSam, sportCode: "FB", defaultTraveler: false },
      ],
    });

    await tx.asset.createMany({
      data: [
        {
          id: ids.camera,
          assetTag: "DEMO-CAM-001",
          name: "Sony FX6 Demo Kit",
          type: "camera",
          brand: "Sony",
          model: "FX6",
          serialNumber: "DEMO-FX6-001",
          qrCodeValue: "DEMO-CAM-001",
          primaryScanCode: "DEMO-CAM-001",
          locationId: ids.location,
          departmentId: ids.department,
          categoryId: ids.cameraCategory,
          notes: "Demo camera for App Review.",
        },
        {
          id: ids.lens,
          assetTag: "DEMO-LENS-001",
          name: "Sony 24-70mm Demo Lens",
          type: "lens",
          brand: "Sony",
          model: "FE 24-70mm F2.8 GM II",
          serialNumber: "DEMO-LENS-001",
          qrCodeValue: "DEMO-LENS-001",
          primaryScanCode: "DEMO-LENS-001",
          locationId: ids.location,
          departmentId: ids.department,
          categoryId: ids.lensCategory,
          notes: "Demo lens for App Review.",
        },
        {
          id: ids.audio,
          assetTag: "DEMO-AUDIO-001",
          name: "Rode Wireless Pro Demo Kit",
          type: "audio",
          brand: "Rode",
          model: "Wireless Pro",
          serialNumber: "DEMO-AUDIO-001",
          qrCodeValue: "DEMO-AUDIO-001",
          primaryScanCode: "DEMO-AUDIO-001",
          locationId: ids.location,
          departmentId: ids.department,
          categoryId: ids.audioCategory,
          notes: "Demo audio kit for App Review.",
        },
        {
          id: ids.tripod,
          assetTag: "DEMO-TRIPOD-001",
          name: "Sachtler Demo Tripod",
          type: "support",
          brand: "Sachtler",
          model: "Flowtech 75",
          serialNumber: "DEMO-TRIPOD-001",
          qrCodeValue: "DEMO-TRIPOD-001",
          primaryScanCode: "DEMO-TRIPOD-001",
          locationId: ids.location,
          departmentId: ids.department,
          categoryId: ids.supportCategory,
          notes: "Demo support item for App Review.",
        },
      ],
    });

    await tx.bulkSku.create({
      data: {
        id: ids.batterySku,
        name: "Sony NP-FZ100 Demo Battery",
        category: "Batteries",
        unit: "battery",
        locationId: ids.location,
        categoryId: ids.supportCategory,
        departmentId: ids.department,
        binQrCodeValue: "DEMO-BATT",
        minThreshold: 2,
        trackByNumber: true,
        notes: "Numbered demo batteries for App Review.",
      },
    });

    await tx.bulkSkuUnit.createMany({
      data: [
        { id: ids.batteryUnit1, bulkSkuId: ids.batterySku, unitNumber: 1, status: BulkUnitStatus.CHECKED_OUT },
        { id: ids.batteryUnit2, bulkSkuId: ids.batterySku, unitNumber: 2, status: BulkUnitStatus.AVAILABLE },
        { id: ids.batteryUnit3, bulkSkuId: ids.batterySku, unitNumber: 3, status: BulkUnitStatus.AVAILABLE },
        { id: ids.batteryUnit4, bulkSkuId: ids.batterySku, unitNumber: 4, status: BulkUnitStatus.AVAILABLE },
      ],
    });

    await tx.bulkStockBalance.create({
      data: {
        bulkSkuId: ids.batterySku,
        locationId: ids.location,
        onHandQuantity: 4,
      },
    });

    await tx.calendarEvent.createMany({
      data: [
        {
          id: ids.eventToday,
          externalId: "demo-media-day",
          summary: "[DEMO] Volleyball Media Day",
          rawSummary: "[DEMO] Volleyball Media Day",
          startsAt: hoursFromNow(3),
          endsAt: hoursFromNow(6),
          locationId: ids.location,
          sportCode: "VB",
          isHome: true,
          opponent: "Demo State",
          subtitle: "App Review demo event",
        },
        {
          id: ids.eventUpcoming,
          externalId: "demo-football-preview",
          summary: "[DEMO] Football Preview Shoot",
          rawSummary: "[DEMO] Football Preview Shoot",
          startsAt: daysFromNow(3, 13),
          endsAt: daysFromNow(3, 17),
          locationId: ids.location,
          sportCode: "FB",
          isHome: true,
          opponent: "Demo Tech",
          subtitle: "App Review demo event",
        },
      ],
    });

    await tx.shiftGroup.create({
      data: {
        id: ids.shiftGroupToday,
        eventId: ids.eventToday,
        isPremier: true,
        publishedAt: now,
        publishedById: ids.reviewer,
        generatedAt: now,
      },
    });

    await tx.shift.create({
      data: {
        id: ids.shiftToday,
        shiftGroupId: ids.shiftGroupToday,
        area: ShiftArea.VIDEO,
        workerType: ShiftWorkerType.FT,
        startsAt: hoursFromNow(2),
        endsAt: hoursFromNow(6),
        callStartsAt: hoursFromNow(2),
        callEndsAt: hoursFromNow(6),
      },
    });

    await tx.shiftAssignment.create({
      data: {
        id: ids.shiftAssignmentToday,
        shiftId: ids.shiftToday,
        userId: ids.reviewer,
        status: ShiftAssignmentStatus.DIRECT_ASSIGNED,
        assignedBy: ids.reviewer,
        acknowledgedAt: now,
        acknowledgedById: ids.reviewer,
      },
    });

    await tx.booking.createMany({
      data: [
        {
          id: ids.openCheckout,
          kind: BookingKind.CHECKOUT,
          title: "[DEMO] Media Day Checkout",
          requesterUserId: ids.reviewer,
          locationId: ids.location,
          startsAt: hoursFromNow(-4),
          endsAt: hoursFromNow(5),
          status: BookingStatus.OPEN,
          createdBy: ids.reviewer,
          eventId: ids.eventToday,
          sportCode: "VB",
          shiftAssignmentId: ids.shiftAssignmentToday,
          notes: "Active demo checkout for App Review.",
        },
        {
          id: ids.overdueCheckout,
          kind: BookingKind.CHECKOUT,
          title: "[DEMO] Overdue Audio Return",
          requesterUserId: ids.studentAlex,
          locationId: ids.location,
          startsAt: hoursFromNow(-30),
          endsAt: hoursFromNow(-6),
          status: BookingStatus.OPEN,
          createdBy: ids.reviewer,
          notes: "Overdue demo checkout for App Review.",
        },
        {
          id: ids.pendingPickup,
          kind: BookingKind.RESERVATION,
          title: "[DEMO] Pending Pickup Reservation",
          requesterUserId: ids.studentSam,
          locationId: ids.location,
          startsAt: hoursFromNow(8),
          endsAt: hoursFromNow(28),
          status: BookingStatus.PENDING_PICKUP,
          createdBy: ids.reviewer,
          eventId: ids.eventUpcoming,
          sportCode: "FB",
          notes: "Pending pickup demo reservation for App Review.",
        },
        {
          id: ids.upcomingReservation,
          kind: BookingKind.RESERVATION,
          title: "[DEMO] Upcoming Studio Reservation",
          requesterUserId: ids.reviewer,
          locationId: ids.location,
          startsAt: daysFromNow(2, 10),
          endsAt: daysFromNow(2, 14),
          status: BookingStatus.BOOKED,
          createdBy: ids.reviewer,
          notes: "Upcoming demo reservation for App Review.",
        },
        {
          id: ids.completedCheckout,
          kind: BookingKind.CHECKOUT,
          title: "[DEMO] Completed Checkout",
          requesterUserId: ids.staffMaya,
          locationId: ids.location,
          startsAt: hoursFromNow(-72),
          endsAt: hoursFromNow(-48),
          status: BookingStatus.COMPLETED,
          createdBy: ids.reviewer,
          completedAt: hoursFromNow(-49),
          notes: "Completed demo checkout for App Review.",
        },
      ],
    });

    await tx.bookingSerializedItem.createMany({
      data: [
        { bookingId: ids.openCheckout, assetId: ids.camera },
        { bookingId: ids.overdueCheckout, assetId: ids.audio },
        { bookingId: ids.pendingPickup, assetId: ids.lens },
        { bookingId: ids.upcomingReservation, assetId: ids.tripod },
        { bookingId: ids.completedCheckout, assetId: ids.tripod, allocationStatus: "returned" },
      ],
    });

    await tx.assetAllocation.createMany({
      data: [
        {
          assetId: ids.camera,
          bookingId: ids.openCheckout,
          startsAt: hoursFromNow(-4),
          endsAt: hoursFromNow(5),
          active: true,
          kind: AllocationKind.CHECKOUT,
        },
        {
          assetId: ids.audio,
          bookingId: ids.overdueCheckout,
          startsAt: hoursFromNow(-30),
          endsAt: hoursFromNow(-6),
          active: true,
          kind: AllocationKind.CHECKOUT,
        },
        {
          assetId: ids.lens,
          bookingId: ids.pendingPickup,
          startsAt: hoursFromNow(8),
          endsAt: hoursFromNow(28),
          active: true,
          kind: AllocationKind.RESERVATION,
        },
        {
          assetId: ids.tripod,
          bookingId: ids.upcomingReservation,
          startsAt: daysFromNow(2, 10),
          endsAt: daysFromNow(2, 14),
          active: true,
          kind: AllocationKind.RESERVATION,
        },
        {
          assetId: ids.tripod,
          bookingId: ids.completedCheckout,
          startsAt: hoursFromNow(-72),
          endsAt: hoursFromNow(-48),
          active: false,
          kind: AllocationKind.CHECKOUT,
        },
      ],
    });

    const batteryBookingItem = await tx.bookingBulkItem.create({
      data: {
        bookingId: ids.openCheckout,
        bulkSkuId: ids.batterySku,
        plannedQuantity: 1,
        checkedOutQuantity: 1,
      },
    });

    await tx.bookingBulkUnitAllocation.create({
      data: {
        bookingBulkItemId: batteryBookingItem.id,
        bulkSkuUnitId: ids.batteryUnit1,
        checkedOutAt: hoursFromNow(-4),
      },
    });

    await tx.bulkStockMovement.create({
      data: {
        bulkSkuId: ids.batterySku,
        locationId: ids.location,
        bookingId: ids.openCheckout,
        actorUserId: ids.reviewer,
        kind: BulkMovementKind.CHECKOUT,
        quantity: 1,
        reason: "App Review demo checkout",
      },
    });

    await tx.favoriteItem.createMany({
      data: [
        { userId: ids.reviewer, assetId: ids.camera },
        { userId: ids.reviewer, assetId: ids.lens },
      ],
    });

    await tx.favoriteItemFamily.create({
      data: {
        userId: ids.reviewer,
        bulkSkuId: ids.batterySku,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          userId: ids.reviewer,
          type: "demo_checkout_due",
          title: "Demo checkout due today",
          body: "Sony FX6 Demo Kit is due back after media day.",
          payload: { bookingId: ids.openCheckout },
          channel: NotificationChannel.IN_APP,
        },
        {
          userId: ids.reviewer,
          type: "demo_shift_reminder",
          title: "Demo shift starts soon",
          body: "Volleyball Media Day call time is coming up.",
          payload: { eventId: ids.eventToday },
          channel: NotificationChannel.IN_APP,
        },
      ],
    });
  });

  console.log("App Review demo seed complete.");
  console.log("Login: appreview@wisconsincreative.com");
  console.log(`Password: ${password}`);
  console.log("Sample QR codes: DEMO-CAM-001, DEMO-LENS-001, DEMO-AUDIO-001, DEMO-BATT-1");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
