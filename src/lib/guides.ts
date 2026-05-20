import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { Role, ShiftArea } from "@prisma/client";
import { sanitizeJsonStrings, sanitizeText } from "@/lib/sanitize";
import {
  legacyGuideMarkdown,
  markdownToPlainText,
  summarizeGuideContent,
  summarizeMarkdown,
} from "@/lib/guide-content";
import {
  type GuideAudience,
  guidePersonalizationReason,
  sortGuidesForAudience,
} from "@/lib/guide-ranking";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await db.resource.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export type GuideListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  markdown: string;
  targetRoles: Role[];
  targetAreas: ShiftArea[];
  featured: boolean;
  featuredRank: number | null;
  lastVerifiedAt: Date | null;
  lastVerifiedBy: { id: string; name: string } | null;
  personalizationReason: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
};

export async function getGuideAudience(userId: string, fallbackRole: Role): Promise<GuideAudience> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      primaryArea: true,
      areaAssignments: { select: { area: true, isPrimary: true } },
    },
  });

  return {
    role: user?.role ?? fallbackRole,
    primaryArea: user?.primaryArea ?? null,
    areaAssignments: user?.areaAssignments ?? [],
  };
}

export async function listGuides(opts: {
  published?: boolean;
  category?: string;
  search?: string;
  audience?: GuideAudience;
}): Promise<GuideListItem[]> {
  const guides = await db.resource.findMany({
    where: {
      ...(opts.published !== undefined && { published: opts.published }),
      ...(opts.category && { category: opts.category }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      content: true,
      markdown: true,
      targetRoles: true,
      targetAreas: true,
      featured: true,
      featuredRank: true,
      lastVerifiedAt: true,
      lastVerifiedBy: { select: { id: true, name: true } },
      published: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const q = opts.search?.trim().toLowerCase();

  const prepared = guides.map((guide) => {
    const markdown = legacyGuideMarkdown(guide.markdown, guide.content);
    const summary = markdown
      ? summarizeMarkdown(markdown)
      : summarizeGuideContent(guide.content);
    return {
      item: {
        id: guide.id,
        title: guide.title,
        slug: guide.slug,
        category: guide.category,
        summary,
        markdown,
        targetRoles: guide.targetRoles,
        targetAreas: guide.targetAreas,
        featured: guide.featured,
        featuredRank: guide.featuredRank,
        lastVerifiedAt: guide.lastVerifiedAt,
        lastVerifiedBy: guide.lastVerifiedBy,
        personalizationReason: opts.audience
          ? guidePersonalizationReason(guide, opts.audience)
          : "General",
        published: guide.published,
        createdAt: guide.createdAt,
        updatedAt: guide.updatedAt,
        author: guide.author,
      },
      searchText: markdownToPlainText(markdown),
    };
  });

  const filtered = prepared
    .filter((guide) => {
      if (!q) return true;
      const searchable = [
        guide.item.title,
        guide.item.category,
        guide.item.author.name,
        guide.item.summary,
        guide.searchText,
        guide.item.markdown,
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    })
    .map((guide) => guide.item);

  return opts.audience ? sortGuidesForAudience(filtered, opts.audience) : filtered;
}

export async function getGuide(id: string) {
  const guide = await db.resource.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      lastVerifiedBy: { select: { id: true, name: true } },
    },
  });
  if (!guide) throw new HttpError(404, "Resource not found");
  return guide;
}

export async function getGuideBySlug(slug: string) {
  const guide = await db.resource.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true } },
      lastVerifiedBy: { select: { id: true, name: true } },
    },
  });
  if (!guide) throw new HttpError(404, "Resource not found");
  return guide;
}

export async function createGuide(data: {
  title: string;
  category: string;
  content?: unknown;
  markdown?: string;
  targetRoles?: Role[];
  targetAreas?: ShiftArea[];
  featured?: boolean;
  featuredRank?: number | null;
  published?: boolean;
  authorId: string;
}) {
  const base = slugify(data.title) || "guide";
  const slug = await uniqueSlug(base);
  const markdown = sanitizeText(data.markdown ?? "");

  return db.resource.create({
    data: {
      title: data.title,
      slug,
      category: data.category,
      content: sanitizeJsonStrings(data.content ?? []) as never,
      markdown,
      targetRoles: data.targetRoles ?? [],
      targetAreas: data.targetAreas ?? [],
      featured: data.featured ?? false,
      featuredRank: data.featured ? data.featuredRank ?? null : null,
      published: data.published ?? false,
      authorId: data.authorId,
    },
    include: {
      author: { select: { id: true, name: true } },
      lastVerifiedBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateGuide(
  id: string,
  patch: {
    title?: string;
    category?: string;
    content?: unknown;
    markdown?: string;
    targetRoles?: Role[];
    targetAreas?: ShiftArea[];
    featured?: boolean;
    featuredRank?: number | null;
    published?: boolean;
    expectedUpdatedAt?: string;
    markVerified?: boolean;
  },
  editorRole: Role,
  editorId: string,
) {
  const guide = await db.resource.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      slug: true,
      title: true,
      updatedAt: true,
      featured: true,
      featuredRank: true,
    },
  });
  if (!guide) throw new HttpError(404, "Resource not found");

  // STAFF can only edit their own guides
  if (editorRole === Role.STAFF && guide.authorId !== editorId) {
    throw new HttpError(403, "You can only edit your own resources");
  }

  // Optimistic concurrency check
  if (
    patch.expectedUpdatedAt &&
    guide.updatedAt.toISOString() !== patch.expectedUpdatedAt
  ) {
    throw new HttpError(
      409,
      "This resource was edited by someone else since you opened it. Reload to see their changes.",
    );
  }

  let slug: string | undefined;
  if (patch.title && patch.title !== guide.title) {
    const base = slugify(patch.title) || "guide";
    slug = await uniqueSlug(base, id);
  }

  const verifiedAt = patch.markVerified ? new Date() : undefined;
  const nextFeatured = patch.featured ?? guide.featured;
  const shouldUpdateFeaturedRank =
    patch.featured !== undefined || patch.featuredRank !== undefined;
  const nextFeaturedRank = nextFeatured
    ? patch.featuredRank !== undefined
      ? patch.featuredRank
      : guide.featuredRank
    : null;

  return db.resource.update({
    where: { id },
    data: {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(slug !== undefined && { slug }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.content !== undefined && { content: sanitizeJsonStrings(patch.content) as never }),
      ...(patch.markdown !== undefined && { markdown: sanitizeText(patch.markdown) }),
      ...(patch.targetRoles !== undefined && { targetRoles: patch.targetRoles }),
      ...(patch.targetAreas !== undefined && { targetAreas: patch.targetAreas }),
      ...(patch.featured !== undefined && { featured: patch.featured }),
      ...(shouldUpdateFeaturedRank && { featuredRank: nextFeaturedRank }),
      ...(patch.published !== undefined && { published: patch.published }),
      ...(verifiedAt !== undefined && {
        lastVerifiedAt: verifiedAt,
        lastVerifiedById: editorId,
        updatedAt: verifiedAt,
      }),
    },
    include: {
      author: { select: { id: true, name: true } },
      lastVerifiedBy: { select: { id: true, name: true } },
    },
  });
}

export async function deleteGuide(id: string) {
  const guide = await db.resource.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!guide) throw new HttpError(404, "Resource not found");
  return db.resource.delete({ where: { id } });
}
