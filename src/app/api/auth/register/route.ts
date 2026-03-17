import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";

export const POST = withHandler(async (req) => {
  const body = registerSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(body.password);

  let user;
  try {
    user = await db.user.create({
      data: {
        name: body.name,
        email,
        passwordHash,
        role: "STUDENT",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw error;
  }

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
});
