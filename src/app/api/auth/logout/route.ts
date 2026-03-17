import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/http";
import { withAuth } from "@/lib/api";

export const POST = withAuth(async () => {
  await destroySession();
  return ok({ success: true });
});
