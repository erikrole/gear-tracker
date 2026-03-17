import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";

export const POST = withHandler(async (req) => {
  const body = loginSchema.parse(await req.json());
  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    throw new HttpError(401, "Invalid credentials");
  }

  await createSession(user.id, body.rememberMe ?? false);

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});
