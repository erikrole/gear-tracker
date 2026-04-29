import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/** List active users for kiosk avatar grid */
export const GET = withKiosk(async () => {
  const users = await db.user.findMany({
    where: { active: true },
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
