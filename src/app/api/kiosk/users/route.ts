import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { ok } from "@/lib/http";

/** List active users for kiosk avatar grid (local roster plus every active BTN collaborator). */
export const GET = withKiosk(async (_req, { kiosk }) => {
  const users = await db.user.findMany({
    where: {
      active: true,
      hiddenFromRoster: false,
      OR: [
        { locationId: kiosk.locationId },
        { locationId: null },
        {
          role: "COLLABORATOR",
          collaboratorPolicy: {
            is: {
              status: "ACTIVE",
              affiliation: { archivedAt: null },
              grants: { some: { capabilityKey: "KIOSK_ROSTER_ELIGIBLE" } },
            },
          },
        },
      ],
    },
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
