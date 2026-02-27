import argon2 from "argon2";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const location = await prisma.location.upsert({
    where: { name: "Main Cage" },
    create: { name: "Main Cage", address: "Campus" },
    update: {}
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!";
  const passwordHash = await argon2.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: "admin@gearflow.local" },
    create: {
      name: "Gearflow Admin",
      email: "admin@gearflow.local",
      passwordHash,
      role: Role.ADMIN,
      locationId: location.id
    },
    update: {
      passwordHash,
      role: Role.ADMIN,
      locationId: location.id
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
