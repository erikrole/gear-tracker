export const runtime = "edge";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export async function POST() {
  try {
    const location = await db.location.upsert({
      where: { name: "Main Cage" },
      create: { name: "Main Cage", address: "Campus" },
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
