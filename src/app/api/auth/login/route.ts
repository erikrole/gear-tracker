import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";

// Per-account limit is the real brute-force defense; the per-IP ceiling is a
// generous backstop sized so a shared office/campus NAT (many users behind one
// public IP) does not lock out legitimate logins at peak.
const LOGIN_EMAIL_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 }; // per account
const LOGIN_IP_LIMIT = { max: 150, windowMs: 15 * 60 * 1000 }; // per shared IP

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const body = loginSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  const [ipCheck, emailCheck] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT),
    checkRateLimit(`login:email:${email}`, LOGIN_EMAIL_LIMIT),
  ]);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    throw new HttpError(429, "Too many login attempts. Please try again later.");
  }

  const user = await db.user.findUnique({ where: { email } });

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
      role: user.role,
      forcePasswordChange: user.forcePasswordChange,
    }
  });
});
