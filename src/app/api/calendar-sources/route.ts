export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url()
});

export async function GET() {
  try {
    await requireAuth();
    const sources = await db.calendarSource.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { events: true } } }
    });
    return ok({ data: sources });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
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
  } catch (error) {
    return fail(error);
  }
}
