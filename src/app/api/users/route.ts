export const runtime = "edge";
import { requireAuth, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { roleSchema } from "@/lib/validation";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: roleSchema.default("STAFF"),
  locationId: z.string().cuid().nullable().optional()
});

export async function GET() {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN"]);

    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      include: {
        location: {
          select: { name: true }
        }
      }
    });

    return ok({
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location?.name ?? null
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN"]);

    const body = createUserSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, "A user with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);

    const user = await db.user.create({
      data: {
        name: body.name,
        email,
        passwordHash,
        role: body.role,
        locationId: body.locationId ?? null
      },
      include: {
        location: { select: { name: true } }
      }
    });

    return ok(
      {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location?.name ?? null
        }
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
