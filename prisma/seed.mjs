import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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
