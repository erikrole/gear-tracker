import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { postTradeSchema } from "@/lib/validation";
import { listTrades, postTrade } from "@/lib/services/shift-trades";
import { createAuditEntry } from "@/lib/audit";
import type { ShiftTradeStatus } from "@prisma/client";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_trade", "view");

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const validStatuses: ShiftTradeStatus[] = ["OPEN", "CLAIMED", "COMPLETED", "CANCELLED"];
  const status = statusParam && validStatuses.includes(statusParam as ShiftTradeStatus)
    ? (statusParam as ShiftTradeStatus)
    : undefined;
  const area = url.searchParams.get("area");

  const trades = await listTrades({
    status,
    area: area ?? undefined,
  });

  return ok({ data: trades });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift_trade", "post");

  const body = postTradeSchema.parse(await req.json());
  const trade = await postTrade(body.shiftAssignmentId, user.id, body.notes);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_trade",
    entityId: trade.id,
    action: "trade_posted",
    after: { shiftAssignmentId: body.shiftAssignmentId },
  });

  return ok({ data: trade }, 201);
});
