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

    await db.location.upsert({
      where: { name: "Camp Randall" },
      create: { name: "Camp Randall", address: "1440 Monroe St, Madison, WI" },
      update: {},
    });

    await db.location.upsert({
      where: { name: "Kohl Center" },
      create: { name: "Kohl Center", address: "601 W Dayton St, Madison, WI" },
      update: {},
    });

    const passwordHash = await bcrypt.hash("ChangeMeNow123!", 10);

    const user = await db.user.upsert({
      where: { email: "admin@gearflow.local" },
      create: {
        name: "Gearflow Admin",
        email: "admin@gearflow.local",
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
      hint: "Login with admin@gearflow.local / ChangeMeNow123!",
    });
  } catch (error) {
    return fail(error);
  }
}
