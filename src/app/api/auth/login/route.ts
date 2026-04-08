import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";

const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 }; // 10 attempts per 15 min

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`login:${ip}`, LOGIN_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many login attempts. Please try again later.");

  const body = loginSchema.parse(await req.json());
  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  if (!user.active) {
    throw new HttpError(403, "Your account has been deactivated. Contact an administrator.");
  }

  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    throw new HttpError(401, "Invalid credentials");
  }

  await createSession(user.id, body.rememberMe ?? false);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "session",
    entityId: user.id,
    action: "login",
    after: { ip },
  });

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});
