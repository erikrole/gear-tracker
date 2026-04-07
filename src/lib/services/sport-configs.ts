import { Prisma, ShiftArea } from "@prisma/client";
import { db } from "@/lib/db";

export type SportShiftConfigInput = {
  area: ShiftArea;
  homeCount: number;
  awayCount: number;
};

/** Get all sport configs with their shift config rows */
export async function getAllSportConfigs() {
  return db.sportConfig.findMany({
    include: { shiftConfigs: true },
    orderBy: { sportCode: "asc" },
  });
}

/** Get a single sport config by sportCode */
export async function getSportConfig(sportCode: string) {
  return db.sportConfig.findUnique({
    where: { sportCode },
    include: { shiftConfigs: true },
  });
}

/** Create or update a sport config with shift configs */
export async function upsertSportConfig(
  sportCode: string,
  active: boolean,
  shiftConfigs: SportShiftConfigInput[],
  callTimeBefore?: number,
  callTimeAfter?: number,
) {
  return db.$transaction(async (tx) => {
    // Upsert the sport config
    const config = await tx.sportConfig.upsert({
      where: { sportCode },
      create: { sportCode, active, ...(callTimeBefore !== undefined && { callTimeBefore }), ...(callTimeAfter !== undefined && { callTimeAfter }) },
      update: { active, ...(callTimeBefore !== undefined && { callTimeBefore }), ...(callTimeAfter !== undefined && { callTimeAfter }) },
    });

    // Upsert each shift config row
    for (const sc of shiftConfigs) {
      await tx.sportShiftConfig.upsert({
        where: {
          sportConfigId_area: {
            sportConfigId: config.id,
            area: sc.area,
          },
        },
        create: {
          sportConfigId: config.id,
          area: sc.area,
          homeCount: sc.homeCount,
          awayCount: sc.awayCount,
        },
        update: {
          homeCount: sc.homeCount,
          awayCount: sc.awayCount,
        },
      });
    }

    return tx.sportConfig.findUnique({
      where: { id: config.id },
      include: { shiftConfigs: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Toggle a sport config active/inactive */
export async function toggleSportConfig(sportCode: string, active: boolean) {
  return db.sportConfig.update({
    where: { sportCode },
    data: { active },
    include: { shiftConfigs: true },
  });
}

/** Get roster (students/staff) assigned to a sport */
export async function getSportRoster(sportCode: string) {
  const assignments = await db.studentSportAssignment.findMany({
    where: { sportCode },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, primaryArea: true },
      },
    },
    orderBy: { user: { name: "asc" } },
  });
  return assignments.map((a) => ({
    id: a.id,
    userId: a.userId,
    sportCode: a.sportCode,
    user: a.user,
    createdAt: a.createdAt,
  }));
}

/** Add a user to a sport roster */
export async function addToRoster(userId: string, sportCode: string) {
  return db.studentSportAssignment.create({
    data: { userId, sportCode },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, primaryArea: true },
      },
    },
  });
}

/** Remove a user from a sport roster */
export async function removeFromRoster(assignmentId: string) {
  return db.studentSportAssignment.delete({
    where: { id: assignmentId },
  });
}

/** Bulk add users to a sport roster */
export async function bulkAddToRoster(userIds: string[], sportCode: string) {
  // Use createMany with skipDuplicates to handle existing assignments
  await db.studentSportAssignment.createMany({
    data: userIds.map((userId) => ({ userId, sportCode })),
    skipDuplicates: true,
  });
  return getSportRoster(sportCode);
}
