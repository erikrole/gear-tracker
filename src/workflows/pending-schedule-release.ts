import { sleep } from "workflow";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  createPublishedShiftGroupNotifications,
  notifyPublishedScheduleFollowers,
  notifyPublishedShiftGroupWorkers,
} from "@/lib/services/notifications";
import { publishShiftGroup } from "@/lib/services/schedule-publication";

export async function pendingScheduleReleaseWorkflow(
  shiftGroupId: string,
  expectedVersion: number,
  releaseAtIso: string,
) {
  "use workflow";

  const releaseAt = new Date(releaseAtIso);
  if (releaseAt.getTime() > Date.now()) await sleep(releaseAt);
  return releasePendingScheduleVersion(shiftGroupId, expectedVersion);
}

export async function releasePendingScheduleVersion(
  shiftGroupId: string,
  expectedVersion: number,
) {
  "use step";

  const pending = await db.shiftGroupWorkingCopy.findUnique({
    where: { shiftGroupId },
    select: {
      version: true,
      updatedById: true,
      updatedBy: { select: { role: true } },
    },
  });
  if (!pending || pending.version !== expectedVersion) {
    return { status: "superseded" as const, shiftGroupId, expectedVersion };
  }

  try {
    const result = await publishShiftGroup(
      shiftGroupId,
      pending.updatedById,
      expectedVersion,
      pending.updatedBy.role,
    );

    if (!result.before.publishedAt) {
      await createPublishedShiftGroupNotifications(shiftGroupId);
    } else if (result.publishedSnapshotChanged) {
      await Promise.allSettled([
        notifyPublishedShiftGroupWorkers(shiftGroupId, result.affectedUserIds),
        notifyPublishedScheduleFollowers(shiftGroupId),
      ]);
    }

    return {
      status: "released" as const,
      shiftGroupId,
      releasedVersion: result.after,
    };
  } catch (error) {
    if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
      await db.shiftGroupWorkingCopy.updateMany({
        where: { shiftGroupId, version: expectedVersion },
        data: { autoReleaseError: error.message },
      });
      return {
        status: "blocked" as const,
        shiftGroupId,
        expectedVersion,
        error: error.message,
      };
    }
    throw error;
  }
}
