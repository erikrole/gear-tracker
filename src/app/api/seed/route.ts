import bcrypt from "bcryptjs";
import { withAuth, withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";

/**
 * POST /api/seed
 * Bootstraps default locations and admin account.
 * In production, requires ADMIN auth. In development, allows unauthenticated access
 * for initial setup (before any users exist).
 */
export const POST = process.env.NODE_ENV === "production"
  ? withAuth(async (_req, { user }) => {
      if (user.role !== "ADMIN") throw new HttpError(403, "Admin only");
      return runSeed();
    })
  : withHandler(async () => {
      return runSeed();
    });

async function runSeed() {
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
}
