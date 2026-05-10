import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { BadgeCategory, BadgeKind, PrismaClient, Role } from "@prisma/client";

const connectionString = process.env.DATABASE_URL ?? "";
const prisma = connectionString.includes(".neon.tech")
  ? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
  : new PrismaClient();

// Event facilities — marked as home venues for calendar sync
const homeVenues = [
  "Camp Randall Stadium",
  "Kohl Center",
  "UW Field House",
  "LaBahn Arena",
  "Goodman Softball Complex",
  "Porter Boathouse",
  "McClimon Track/Soccer Complex",
  "Soderholm Family Aquatic Center",
  "Nielsen Tennis Stadium",
  "University Ridge",
  "Zimmer Championship Course",
];

// Training/support buildings — locations but not event venues
const supportFacilities = [
  "Stephen M. Bennett Student-Athlete Performance Center",
  "Fetzer Centers",
  "Golf Training Center",
  "McClain Facility",
];

// Legacy names for backwards compat
const legacyNames = {
  "Camp Randall": "Camp Randall Stadium",
  "McClimon Complex": "McClimon Track/Soccer Complex",
};

const badgeDefinitions = [
  {
    key: "first_checkout",
    name: "First Checkout",
    description: "Opened a first gear checkout.",
    icon: "PackageCheck",
    category: BadgeCategory.CHECKOUT,
    kind: BadgeKind.COUNT,
    trigger: "checkout:opened",
    threshold: 1,
    sortOrder: 10,
  },
  {
    key: "checkout_5",
    name: "Gear Regular",
    description: "Opened five gear checkouts.",
    icon: "PackageOpen",
    category: BadgeCategory.CHECKOUT,
    kind: BadgeKind.COUNT,
    trigger: "checkout:opened",
    threshold: 5,
    sortOrder: 20,
  },
  {
    key: "checkout_25",
    name: "Gear Veteran",
    description: "Opened 25 gear checkouts.",
    icon: "Boxes",
    category: BadgeCategory.CHECKOUT,
    kind: BadgeKind.COUNT,
    trigger: "checkout:opened",
    threshold: 25,
    sortOrder: 30,
  },
  {
    key: "checkout_100",
    name: "Gear Master",
    description: "Opened 100 gear checkouts.",
    icon: "Warehouse",
    category: BadgeCategory.CHECKOUT,
    kind: BadgeKind.COUNT,
    trigger: "checkout:opened",
    threshold: 100,
    sortOrder: 40,
  },
  {
    key: "on_time_1",
    name: "Punctual",
    description: "Returned a checkout on time.",
    icon: "Clock3",
    category: BadgeCategory.ON_TIME,
    kind: BadgeKind.COUNT,
    trigger: "checkout:returned",
    threshold: 1,
    ruleKey: "on_time_return",
    sortOrder: 110,
  },
  {
    key: "on_time_10",
    name: "Reliable",
    description: "Returned ten checkouts on time.",
    icon: "CalendarCheck2",
    category: BadgeCategory.ON_TIME,
    kind: BadgeKind.COUNT,
    trigger: "checkout:returned",
    threshold: 10,
    ruleKey: "on_time_return",
    sortOrder: 120,
  },
  {
    key: "on_time_50",
    name: "Clockwork",
    description: "Returned 50 checkouts on time.",
    icon: "AlarmClockCheck",
    category: BadgeCategory.ON_TIME,
    kind: BadgeKind.COUNT,
    trigger: "checkout:returned",
    threshold: 50,
    ruleKey: "on_time_return",
    sortOrder: 130,
  },
  {
    key: "first_scan",
    name: "Scanner",
    description: "Completed a first successful kiosk scan.",
    icon: "ScanLine",
    category: BadgeCategory.SCAN,
    kind: BadgeKind.COUNT,
    trigger: "scan:success",
    threshold: 1,
    sortOrder: 210,
  },
  {
    key: "scan_25",
    name: "Scan Pro",
    description: "Completed 25 successful kiosk scans.",
    icon: "ScanSearch",
    category: BadgeCategory.SCAN,
    kind: BadgeKind.COUNT,
    trigger: "scan:success",
    threshold: 25,
    sortOrder: 220,
  },
  {
    key: "scan_100",
    name: "Scan Master",
    description: "Completed 100 successful kiosk scans.",
    icon: "QrCode",
    category: BadgeCategory.SCAN,
    kind: BadgeKind.COUNT,
    trigger: "scan:success",
    threshold: 100,
    sortOrder: 230,
  },
  {
    key: "zero_errors",
    name: "Clean Scanner",
    description: "Completed ten kiosk scans in a row without an error.",
    icon: "ShieldCheck",
    category: BadgeCategory.SCAN,
    kind: BadgeKind.RULE,
    trigger: "scan:rule",
    threshold: 10,
    ruleKey: "zero_errors",
    sortOrder: 240,
  },
  {
    key: "first_shift",
    name: "On Duty",
    description: "Completed a first shift after attendance tracking ships.",
    icon: "CalendarClock",
    category: BadgeCategory.SHIFT,
    kind: BadgeKind.COUNT,
    trigger: "shift:completed",
    threshold: 1,
    ruleKey: "deferred_attendance",
    sortOrder: 310,
  },
  {
    key: "shift_10",
    name: "Shift Regular",
    description: "Completed ten shifts after attendance tracking ships.",
    icon: "CalendarDays",
    category: BadgeCategory.SHIFT,
    kind: BadgeKind.COUNT,
    trigger: "shift:completed",
    threshold: 10,
    ruleKey: "deferred_attendance",
    sortOrder: 320,
  },
  {
    key: "shift_50",
    name: "Shift Veteran",
    description: "Completed 50 shifts after attendance tracking ships.",
    icon: "CalendarRange",
    category: BadgeCategory.SHIFT,
    kind: BadgeKind.COUNT,
    trigger: "shift:completed",
    threshold: 50,
    ruleKey: "deferred_attendance",
    sortOrder: 330,
  },
  {
    key: "first_trade",
    name: "Team Player",
    description: "Completed a first shift trade.",
    icon: "Handshake",
    category: BadgeCategory.TRADE,
    kind: BadgeKind.COUNT,
    trigger: "trade:completed",
    threshold: 1,
    sortOrder: 410,
  },
  {
    key: "trade_10",
    name: "Trade Expert",
    description: "Completed ten shift trades.",
    icon: "Repeat2",
    category: BadgeCategory.TRADE,
    kind: BadgeKind.COUNT,
    trigger: "trade:completed",
    threshold: 10,
    sortOrder: 420,
  },
  {
    key: "streak_on_time_5",
    name: "On a Roll",
    description: "Returned five checkouts in a row on time.",
    icon: "Flame",
    category: BadgeCategory.STREAK,
    kind: BadgeKind.STREAK,
    trigger: "checkout:returned",
    threshold: 5,
    ruleKey: "on_time_return_streak",
    sortOrder: 510,
  },
  {
    key: "streak_on_time_10",
    name: "Locked In",
    description: "Returned ten checkouts in a row on time.",
    icon: "BadgeCheck",
    category: BadgeCategory.STREAK,
    kind: BadgeKind.STREAK,
    trigger: "checkout:returned",
    threshold: 10,
    ruleKey: "on_time_return_streak",
    sortOrder: 520,
  },
  {
    key: "streak_shifts_5",
    name: "Showing Up",
    description: "Completed five shifts in a row after attendance tracking ships.",
    icon: "UserCheck",
    category: BadgeCategory.STREAK,
    kind: BadgeKind.STREAK,
    trigger: "shift:completed",
    threshold: 5,
    ruleKey: "deferred_attendance_streak",
    sortOrder: 610,
  },
  {
    key: "streak_shifts_10",
    name: "Iron Schedule",
    description: "Completed ten shifts in a row after attendance tracking ships.",
    icon: "Trophy",
    category: BadgeCategory.STREAK,
    kind: BadgeKind.STREAK,
    trigger: "shift:completed",
    threshold: 10,
    ruleKey: "deferred_attendance_streak",
    sortOrder: 620,
  },
];

async function main() {
  // Rename legacy locations
  for (const [oldName, newName] of Object.entries(legacyNames)) {
    const existing = await prisma.location.findUnique({ where: { name: oldName } });
    if (existing) {
      // Only rename if the new name doesn't already exist
      const newExists = await prisma.location.findUnique({ where: { name: newName } });
      if (!newExists) {
        await prisma.location.update({ where: { name: oldName }, data: { name: newName, isHomeVenue: true } });
      }
    }
  }

  // Upsert all home venues
  for (const name of homeVenues) {
    await prisma.location.upsert({
      where: { name },
      create: { name, isHomeVenue: true },
      update: { isHomeVenue: true },
    });
  }

  // Upsert support facilities (not home venues)
  for (const name of supportFacilities) {
    await prisma.location.upsert({
      where: { name },
      create: { name, isHomeVenue: false },
      update: {},
    });
  }

  // ── Venue mapping patterns (ICS location text → Location) ──
  // Each pattern is matched against event venue text during calendar sync.
  // Multiple patterns can map to the same location for flexibility.
  // Only event facilities get venue mappings (not training/support buildings)
  const venueMappings = [
    { patterns: ["Camp Randall"],                          location: "Camp Randall Stadium" },
    { patterns: ["Kohl Center"],                           location: "Kohl Center" },
    { patterns: ["Field House", "UW Field House"],         location: "UW Field House" },
    { patterns: ["LaBahn"],                                location: "LaBahn Arena" },
    { patterns: ["Goodman", "Softball Complex"],           location: "Goodman Softball Complex" },
    { patterns: ["Porter Boathouse", "Boathouse"],         location: "Porter Boathouse" },
    { patterns: ["McClimon"],                              location: "McClimon Track/Soccer Complex" },
    { patterns: ["Soderholm", "Aquatic Center"],           location: "Soderholm Family Aquatic Center" },
    { patterns: ["Nielsen Tennis", "Nielsen Stadium"],     location: "Nielsen Tennis Stadium" },
    { patterns: ["University Ridge"],                      location: "University Ridge" },
    { patterns: ["Zimmer", "Championship Course"],         location: "Zimmer Championship Course" },
  ];

  for (const { patterns, location: locationName } of venueMappings) {
    const loc = await prisma.location.findUnique({ where: { name: locationName } });
    if (!loc) continue;
    for (const pattern of patterns) {
      await prisma.locationMapping.upsert({
        where: { id: `seed-${pattern.toLowerCase().replace(/\s+/g, "-")}` },
        create: {
          id: `seed-${pattern.toLowerCase().replace(/\s+/g, "-")}`,
          pattern,
          locationId: loc.id,
          priority: 10,
        },
        update: {
          pattern,
          locationId: loc.id,
          priority: 10,
        },
      });
    }
  }

  const campRandall = await prisma.location.findFirst({
    where: { name: { startsWith: "Camp Randall" } }
  }) ?? await prisma.location.findFirstOrThrow({});

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: "admin@creative.local" },
    create: {
      name: "Creative Admin",
      email: "admin@creative.local",
      passwordHash,
      role: Role.ADMIN,
      locationId: campRandall.id
    },
    update: {
      passwordHash,
      role: Role.ADMIN,
      locationId: campRandall.id
    }
  });

  await prisma.systemConfig.upsert({
    where: { key: "badges.peerVisible" },
    create: { key: "badges.peerVisible", value: true },
    update: {},
  });

  for (const definition of badgeDefinitions) {
    await prisma.badgeDefinition.upsert({
      where: { key: definition.key },
      create: definition,
      update: {
        name: definition.name,
        description: definition.description,
        icon: definition.icon,
        category: definition.category,
        kind: definition.kind,
        trigger: definition.trigger,
        threshold: definition.threshold,
        ruleKey: definition.ruleKey,
        sortOrder: definition.sortOrder,
      },
    });
  }

  console.log("Seed complete: admin@creative.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
