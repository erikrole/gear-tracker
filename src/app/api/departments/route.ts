import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export const GET = withAuth(async () => {
  const departments = await db.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return ok({ data: departments });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "edit");

  const body = createSchema.parse(await req.json());

  const existing = await db.department.findUnique({
    where: { name: body.name },
  });
  if (existing) {
    if (!existing.active) {
      const dept = await db.department.update({
        where: { id: existing.id },
        data: { active: true },
      });
      return ok({ data: { id: dept.id, name: dept.name } }, 200);
    }
    throw new HttpError(409, "Department already exists");
  }

  const department = await db.department.create({
    data: { name: body.name },
  });

  return ok({ data: { id: department.id, name: department.name } }, 201);
});
