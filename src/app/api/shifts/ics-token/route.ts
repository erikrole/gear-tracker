import { randomBytes } from "crypto";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

// Returns the current user's existing ICS token (null if none generated yet).
export const GET = withAuth(async (_req, { user }) => {
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { icsToken: true },
  });
  return ok({ token: row?.icsToken ?? null });
});

// Generate or rotate the current user's ICS subscription token.
export const POST = withAuth(async (_req, { user }) => {
  const token = randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: { icsToken: token },
  });
  return ok({ token });
});
