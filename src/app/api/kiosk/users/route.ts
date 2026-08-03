import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";
import { kioskRosterUserWhere } from "@/lib/user-visibility";

/** List every active, visible person allowed in the staffed kiosk roster. */
export const GET = withKiosk(async () => {
  const users = await db.user.findMany({
    where: kioskRosterUserWhere(),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      affiliation: true,
      collaboratorPolicy: {
        select: { affiliation: { select: { key: true, badgeLabel: true } } },
      },
    },
  });

  return ok({
    data: users.map(({ collaboratorPolicy, ...user }) => ({
      ...user,
      affiliation: collaboratorPolicy?.affiliation.key ?? user.affiliation,
      affiliationBadge: collaboratorPolicy?.affiliation.badgeLabel ?? null,
    })),
  });
});
