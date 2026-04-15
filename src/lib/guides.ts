import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { Role } from "@prisma/client";

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
    const existing = await db.guide.findUnique({
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
  published: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
};

export async function listGuides(opts: {
  published?: boolean;
  category?: string;
  search?: string;
}): Promise<GuideListItem[]> {
  return db.guide.findMany({
    where: {
      ...(opts.published !== undefined && { published: opts.published }),
      ...(opts.category && { category: opts.category }),
      ...(opts.search && {
        title: { contains: opts.search, mode: "insensitive" },
      }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      published: true,
      order: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getGuide(id: string) {
  const guide = await db.guide.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!guide) throw new HttpError(404, "Guide not found");
  return guide;
}

export async function getGuideBySlug(slug: string) {
  const guide = await db.guide.findUnique({
    where: { slug },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!guide) throw new HttpError(404, "Guide not found");
  return guide;
}

export async function createGuide(data: {
  title: string;
  category: string;
  content: unknown;
  published?: boolean;
  authorId: string;
}) {
  const base = slugify(data.title) || "guide";
  const slug = await uniqueSlug(base);

  return db.guide.create({
    data: {
      title: data.title,
      slug,
      category: data.category,
      content: data.content as never,
      published: data.published ?? false,
      authorId: data.authorId,
    },
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function updateGuide(
  id: string,
  patch: {
    title?: string;
    category?: string;
    content?: unknown;
    published?: boolean;
    order?: number;
  },
  editorRole: Role,
  editorId: string,
) {
  const guide = await db.guide.findUnique({
    where: { id },
    select: { id: true, authorId: true, slug: true, title: true },
  });
  if (!guide) throw new HttpError(404, "Guide not found");

  // STAFF can only edit their own guides
  if (editorRole === Role.STAFF && guide.authorId !== editorId) {
    throw new HttpError(403, "You can only edit your own guides");
  }

  let slug: string | undefined;
  if (patch.title && patch.title !== guide.title) {
    const base = slugify(patch.title) || "guide";
    slug = await uniqueSlug(base, id);
  }

  return db.guide.update({
    where: { id },
    data: {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(slug !== undefined && { slug }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.content !== undefined && { content: patch.content as never }),
      ...(patch.published !== undefined && { published: patch.published }),
      ...(patch.order !== undefined && { order: patch.order }),
    },
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function deleteGuide(id: string) {
  const guide = await db.guide.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!guide) throw new HttpError(404, "Guide not found");
  return db.guide.delete({ where: { id } });
}
