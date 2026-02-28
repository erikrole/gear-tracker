import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const defaultLocations = ["Camp Randall", "Kohl Center"];

async function main() {
  for (const name of defaultLocations) {
    await prisma.location.upsert({
      where: { name },
      create: { name },
      update: {}
    });
  }

  const campRandall = await prisma.location.findUniqueOrThrow({
    where: { name: "Camp Randall" }
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: "admin@gearflow.local" },
    create: {
      name: "Gearflow Admin",
      email: "admin@gearflow.local",
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

  console.log("Seed complete: admin@gearflow.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
