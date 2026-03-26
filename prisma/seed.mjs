import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const homeVenues = [
  "Camp Randall Stadium",
  "Kohl Center",
  "UW Field House",
  "LaBahn Arena",
  "Goodman Softball Complex",
  "Porter Boathouse",
  "McClimon Complex",
  "Soderholm Family Aquatic Center",
  "Nielsen Tennis Stadium",
  "University Ridge",
  "Zimmer Championship Course",
];

// Legacy names for backwards compat
const legacyNames = { "Camp Randall": "Camp Randall Stadium" };

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
