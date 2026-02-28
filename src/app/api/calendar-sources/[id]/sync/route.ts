export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { syncCalendarSource } from "@/lib/services/calendar-sync";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;
    const result = await syncCalendarSource(id);
    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
