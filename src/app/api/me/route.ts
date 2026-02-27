export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireAuth();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}
