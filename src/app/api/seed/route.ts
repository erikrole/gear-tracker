export const runtime = "edge";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";

export async function POST() {
  try {
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
  } catch (error) {
    return fail(error);
  }
}
