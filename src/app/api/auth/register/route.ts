export const runtime = "edge";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { fail, HttpError, ok } from "@/lib/http";
import { registerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);

    const user = await db.user.create({
      data: {
        name: body.name,
        email,
        passwordHash,
        role: "STUDENT",
      },
    });

    await createSession(user.id);

    return ok(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
