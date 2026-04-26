import bcrypt from "bcryptjs";
import { withAuth, withHandler } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";

/**
 * POST /api/seed
 * Bootstraps an admin account against the first available home venue.
 * Canonical location seeding lives in prisma/seed.mjs — run that first.
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
  const location = await db.location.findFirst({
    where: { isHomeVenue: true, active: true },
    orderBy: { name: "asc" },
  });
  if (!location) {
    throw new HttpError(
      500,
      "No home venue locations found. Run `npm run db:seed` first to populate canonical locations.",
    );
  }

  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow123!";
  const passwordHash = await bcrypt.hash(seedPassword, 10);

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
    hint: `Login with admin@creative.local / ${seedPassword}`,
  });
}
