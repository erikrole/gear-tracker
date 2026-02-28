export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const { limit, offset } = parsePagination(searchParams);
    const unreadOnly = searchParams.get("unread") === "true";

    const where = {
      userId: user.id,
      ...(unreadOnly ? { readAt: null } : {})
    };

    const [data, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: user.id, readAt: null } })
    ]);

    return ok({ data, total, limit, offset, unreadCount });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    if (body.action === "mark_all_read") {
      await db.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() }
      });
      return ok({ success: true });
    }

    if (body.action === "mark_read" && body.id) {
      await db.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { readAt: new Date() }
      });
      return ok({ success: true });
    }

    return ok({ success: false });
  } catch (error) {
    return fail(error);
  }
}
