import { randomBytes } from "crypto";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

// Generate or rotate the current user's ICS subscription token.
export const POST = withAuth(async (_req, { user }) => {
  const token = randomBytes(24).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: { icsToken: token },
  });
  return ok({ token });
});
