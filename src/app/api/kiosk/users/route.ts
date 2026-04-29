import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/** List active users for kiosk avatar grid (location-scoped: this location + unassigned). */
export const GET = withKiosk(async (_req, { kiosk }) => {
  const users = await db.user.findMany({
    where: {
      active: true,
      OR: [{ locationId: kiosk.locationId }, { locationId: null }],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
  });

  return ok({ data: users });
});
