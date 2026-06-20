import { Role } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { auditVenueMappings } from "@/lib/venue-mapping-audit";

export const GET = withAuth(async (_req, { user }) => {
  if (user.role !== Role.ADMIN) {
    throw new HttpError(403, "Admin only");
  }

  const [locations, mappings] = await Promise.all([
    db.location.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        isHomeVenue: true,
      },
      orderBy: { name: "asc" },
    }),
    db.locationMapping.findMany({
      select: {
        id: true,
        pattern: true,
        locationId: true,
        location: {
          select: {
            id: true,
            name: true,
            active: true,
            isHomeVenue: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const audit = auditVenueMappings(locations, mappings);

  return ok({
    data: {
      ...audit,
      issueCount:
        audit.homeVenuesWithoutMappings.length +
        audit.mappingsToMissingLocations.length +
        audit.mappingsToInactiveLocations.length +
        audit.homeMappingsToNonHomeLocations.length,
    },
  });
});
