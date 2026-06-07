import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAllowedEmailSchema, createAllowedEmailBulkSchema } from "@/lib/validation";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import {
  createAllowedEmailInvite,
  createAllowedEmailInvitesBulk,
} from "@/lib/services/onboarding-lifecycle";

/** List allowed emails (paginated, filterable) */
export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "allowed_email", "view");

  const url = new URL(req.url);
  const { limit, offset } = parsePagination(url.searchParams);
  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status"); // "claimed" | "unclaimed" | null

  const where: Prisma.AllowedEmailWhereInput = {};
  if (q) {
    where.email = { contains: q, mode: "insensitive" };
  }
  if (status === "claimed") {
    where.claimedAt = { not: null };
  } else if (status === "unclaimed") {
    where.claimedAt = null;
  }

  const [data, total] = await Promise.all([
    db.allowedEmail.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        createdBy: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
      },
    }),
    db.allowedEmail.count({ where }),
  ]);

  return ok({ data, total, limit, offset });
});

/** Add a single allowed email or bulk add */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "allowed_email", "create");
  await enforceRateLimit(`allowed-emails:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = await req.json();

  // Bulk add
  if (Array.isArray(body.emails)) {
    const { emails } = createAllowedEmailBulkSchema.parse(body);

    const result = await createAllowedEmailInvitesBulk({ actor: user, emails });

    return ok(
      result,
      201
    );
  }

  // Single add
  const { email: rawEmail, role } = createAllowedEmailSchema.parse(body);
  const email = rawEmail.toLowerCase();

  const result = await createAllowedEmailInvite({ actor: user, email, role });
  if (result.skipped) return ok(result, 201);

  return ok(result.entry, 201);
});
