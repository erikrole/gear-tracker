import { ShiftArea } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { getScheduleOpenWork } from "@/lib/services/schedule-open-work";
import { AREAS } from "@/types/areas";

function parseAreaFilter(value: string | null): ShiftArea | undefined {
  if (!value) return undefined;
  if (!(AREAS as readonly string[]).includes(value)) {
    throw new HttpError(400, "area must be VIDEO, PHOTO, GRAPHICS, or COMMS");
  }
  return value as ShiftArea;
}

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_trade", "view");

  const url = new URL(req.url);
  const area = parseAreaFilter(url.searchParams.get("area"));
  const work = await getScheduleOpenWork({
    userId: user.id,
    role: user.role,
    area,
    limit: 100,
  });

  return ok({ data: work });
});
