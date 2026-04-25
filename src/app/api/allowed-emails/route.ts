import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAllowedEmailSchema, createAllowedEmailBulkSchema } from "@/lib/validation";
import { createAuditEntry, createAuditEntries } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

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

    // STAFF cannot add STAFF-role entries (only ADMIN can)
    if (user.role !== "ADMIN" && emails.some((e) => e.role === "STAFF")) {
      throw new HttpError(403, "Only admins can pre-approve staff accounts");
    }

    const normalized = emails.map((e) => ({
      ...e,
      email: e.email.toLowerCase(),
    }));

    // Check for already-existing emails (either in allowlist or registered users)
    const emailList = normalized.map((e) => e.email);
    const [existingAllowed, existingUsers] = await Promise.all([
      db.allowedEmail.findMany({
        where: { email: { in: emailList } },
        select: { email: true },
      }),
      db.user.findMany({
        where: { email: { in: emailList } },
        select: { email: true },
      }),
    ]);

    const existingSet = new Set([
      ...existingAllowed.map((e) => e.email),
      ...existingUsers.map((e) => e.email),
    ]);

    const toCreate = normalized.filter((e) => !existingSet.has(e.email));
    const skipped = normalized.filter((e) => existingSet.has(e.email));

    if (toCreate.length > 0) {
      await db.allowedEmail.createMany({
        data: toCreate.map((e) => ({
          email: e.email,
          role: e.role,
          createdById: user.id,
        })),
      });

      const created = await db.allowedEmail.findMany({
        where: { email: { in: toCreate.map((e) => e.email) } },
        select: { id: true, email: true, role: true },
      });

      await createAuditEntries(
        created.map((entry) => ({
          actorId: user.id,
          actorRole: user.role,
          entityType: "allowed_email",
          entityId: entry.id,
          action: "created",
          after: { email: entry.email, role: entry.role },
        }))
      );
    }

    return ok(
      { created: toCreate.length, skipped: skipped.map((e) => e.email) },
      201
    );
  }

  // Single add
  const { email: rawEmail, role } = createAllowedEmailSchema.parse(body);
  const email = rawEmail.toLowerCase();

  // STAFF cannot add STAFF-role entries (only ADMIN can pre-assign STAFF)
  if (role === "STAFF" && user.role !== "ADMIN") {
    throw new HttpError(403, "Only admins can pre-approve staff accounts");
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "A user with this email is already registered");
  }

  let entry;
  try {
    entry = await db.allowedEmail.create({
      data: { email, role, createdById: user.id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new HttpError(409, "This email is already on the allowlist");
    }
    throw error;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "allowed_email",
    entityId: entry.id,
    action: "created",
    after: { email, role },
  });

  return ok(entry, 201);
});
