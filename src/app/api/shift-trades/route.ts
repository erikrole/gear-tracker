import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { postTradeSchema } from "@/lib/validation";
import { listTrades, postTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import type { ShiftTradeStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_trade", "view");

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as ShiftTradeStatus | null;
    const area = url.searchParams.get("area");

    const trades = await listTrades({
      status: status ?? undefined,
      area: area ?? undefined,
    });

    return ok({ data: trades });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift_trade", "post");

    const body = postTradeSchema.parse(await req.json());
    const trade = await postTrade(body.shiftAssignmentId, actor.id, body.notes);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_trade",
      entityId: trade.id,
      action: "trade_posted",
      after: { shiftAssignmentId: body.shiftAssignmentId },
    });

    return ok({ data: trade }, 201);
  } catch (error) {
    return fail(error);
  }
}
