import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url()
});

export const GET = withAuth(async () => {
  const sources = await db.calendarSource.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } }
  });
  return ok({ data: sources });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "calendar_source", "create");
  const body = createSourceSchema.parse(await req.json());

  const source = await db.calendarSource.create({
    data: { name: body.name, url: body.url }
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "calendar_source",
    entityId: source.id,
    action: "create",
    after: { name: body.name },
  });

  return ok({ data: source }, 201);
});
