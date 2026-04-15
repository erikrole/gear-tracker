import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { listGuides, createGuide } from "@/lib/guides";
import { createGuideSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { Role } from "@prisma/client";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "guide", "view");

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("q") || undefined;

  // Students only see published guides
  const published = user.role === Role.STUDENT ? true : undefined;

  const guides = await listGuides({ published, category, search });
  return ok({ data: guides });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "guide", "create");

  const body = createGuideSchema.parse(await req.json());
  const guide = await createGuide({
    title: body.title,
    category: body.category,
    content: body.content,
    published: body.published,
    authorId: user.id,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "guide",
    entityId: guide.id,
    action: "guide_created",
    after: { title: guide.title, category: guide.category, published: guide.published },
  });

  return ok({ data: guide }, 201);
});
