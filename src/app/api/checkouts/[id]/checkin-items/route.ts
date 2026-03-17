import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { checkinItems } from "@/lib/services/bookings";
import { requireCheckoutAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

const checkinItemsSchema = z.object({
  assetIds: z.array(z.string().cuid()).min(1),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = checkinItemsSchema.parse(await req.json());

  await requireCheckoutAction(id, user, "checkin");

  const result = await checkinItems(id, user.id, body.assetIds);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "checkin_items",
    after: { assetIds: body.assetIds },
  });

  return ok({ data: result });
});
