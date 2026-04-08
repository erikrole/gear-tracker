import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { withHandler } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuditEntry } from "@/lib/audit";

const REGISTER_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 }; // 5 attempts per 15 min

export const POST = withHandler(async (req) => {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`register:${ip}`, REGISTER_LIMIT);
  if (!allowed) throw new HttpError(429, "Too many registration attempts. Please try again later.");

  const body = registerSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  // ── Allowlist gate ──────────────────────────────────────
  const allowedEntry = await db.allowedEmail.findUnique({
    where: { email },
  });

  if (!allowedEntry) {
    throw new HttpError(
      403,
      "Registration is by invitation only. Contact an administrator to request access."
    );
  }

  if (allowedEntry.claimedAt) {
    throw new HttpError(409, "This invitation has already been used");
  }
  // ────────────────────────────────────────────────────────

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(body.password);

  // Atomic: create user + claim invitation in one transaction
  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name.trim(),
          email,
          passwordHash,
          role: allowedEntry.role, // Use role from allowlist (not hardcoded STUDENT)
        },
      });

      await tx.allowedEmail.update({
        where: { id: allowedEntry.id },
        data: { claimedAt: new Date(), claimedById: created.id },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw error;
  }

  await createSession(user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "user",
    entityId: user.id,
    action: "registered",
    after: { name: user.name, email: user.email, role: user.role },
  });

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
