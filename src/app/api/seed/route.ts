import bcrypt from "bcryptjs";
import { withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";

export const POST = withHandler(async () => {
  for (const locationName of DEFAULT_LOCATIONS) {
    await db.location.upsert({
      where: { name: locationName },
      create: { name: locationName },
      update: {},
    });
  }

  const location = await db.location.findUniqueOrThrow({
    where: { name: "Camp Randall" },
  });

  const passwordHash = await bcrypt.hash("ChangeMeNow123!", 10);

  const user = await db.user.upsert({
    where: { email: "admin@creative.local" },
    create: {
      name: "Creative Admin",
      email: "admin@creative.local",
      passwordHash,
      role: "ADMIN",
      locationId: location.id,
    },
    update: {
      passwordHash,
      role: "ADMIN",
      locationId: location.id,
    },
  });

  return ok({
    message: "Seed complete",
    user: { email: user.email, name: user.name, role: user.role },
    hint: "Login with admin@creative.local / ChangeMeNow123!",
  });
});
