export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

const createMappingSchema = z.object({
  pattern: z.string().min(1),
  locationId: z.string().cuid(),
  priority: z.number().int().min(0).default(0)
});

export async function GET() {
  try {
    await requireAuth();
    const mappings = await db.locationMapping.findMany({
      include: { location: { select: { id: true, name: true } } },
      orderBy: { priority: "desc" }
    });
    return ok({ data: mappings });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = createMappingSchema.parse(await req.json());

    const mapping = await db.locationMapping.create({
      data: body,
      include: { location: { select: { id: true, name: true } } }
    });

    return ok({ data: mapping }, 201);
  } catch (error) {
    return fail(error);
  }
}
