import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

const schema = z.object({
  assetIds: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum(["add", "remove"]),
});

export const POST = withAuth(async (req, { user }) => {
  const { assetIds, action } = schema.parse(await req.json());

  if (action === "add") {
    await db.favoriteItem.createMany({
      data: assetIds.map((assetId) => ({ userId: user.id, assetId })),
      skipDuplicates: true,
    });
  } else {
    await db.favoriteItem.deleteMany({
      where: { userId: user.id, assetId: { in: assetIds } },
    });
  }

  return ok({ data: { count: assetIds.length, action } });
});
