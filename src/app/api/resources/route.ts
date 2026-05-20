import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { listGuides, createGuide, getGuideAudience } from "@/lib/guides";
import { createGuideSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { Role } from "@prisma/client";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "resource", "view");

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("q") || undefined;

  // Students only see published guides
  const published = user.role === Role.STUDENT ? true : undefined;

  const audience = await getGuideAudience(user.id, user.role);
  const guides = await listGuides({ published, category, search, audience });
  return ok({ data: guides });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "resource", "create");

  const body = createGuideSchema.parse(await req.json());
  const guide = await createGuide({
    title: body.title,
    category: body.category,
    content: body.content,
    markdown: body.markdown,
    targetRoles: body.targetRoles,
    targetAreas: body.targetAreas,
    featured: body.featured,
    featuredRank: body.featuredRank,
    published: body.published,
    authorId: user.id,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "resource",
    entityId: guide.id,
    action: "resource_created",
    after: {
      title: guide.title,
      category: guide.category,
      published: guide.published,
      featured: guide.featured,
      featuredRank: guide.featuredRank,
      targetRoles: guide.targetRoles,
      targetAreas: guide.targetAreas,
    },
  });

  return ok({ data: guide }, 201);
});
