import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { createDirectUserAccountsBulk } from "@/lib/services/onboarding-lifecycle";
import { roleSchema } from "@/lib/validation";

const bulkCreateUserSchema = z.object({
  users: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email(),
    role: roleSchema.default("STUDENT"),
    locationId: z.string().cuid().nullable().optional(),
  })).min(1).max(50),
});

function generateTemporaryPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

export const POST = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN", "STAFF"]);

  const body = bulkCreateUserSchema.parse(await req.json());

  if (user.role !== "ADMIN" && body.users.some((entry) => entry.role !== "STUDENT")) {
    throw new HttpError(403, "Staff can only create student users");
  }

  const withPasswords = await Promise.all(body.users.map(async (entry) => {
    const temporaryPassword = generateTemporaryPassword();
    return {
      ...entry,
      temporaryPassword,
      passwordHash: await hashPassword(temporaryPassword),
    };
  }));

  try {
    const result = await createDirectUserAccountsBulk({
      actor: user,
      users: withPasswords.map((entry) => ({
        name: entry.name,
        email: entry.email,
        role: entry.role,
        locationId: entry.locationId ?? null,
        passwordHash: entry.passwordHash,
      })),
    });

    const passwordsByEmail = new Map(withPasswords.map((entry) => [entry.email.trim().toLowerCase(), entry.temporaryPassword]));

    return ok({
      data: result.created.map((created) => ({
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        locationId: created.locationId,
        location: created.location?.name ?? null,
        temporaryPassword: passwordsByEmail.get(created.email) ?? "",
        forcePasswordChange: true,
      })),
    }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "One or more users already exist");
    }
    throw err;
  }
});
