import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createKit, listKits } from "@/lib/services/kits";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  locationId: z.string().min(1, "Location is required"),
});

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "kit", "view");

  const { searchParams } = new URL(req.url);
  const { limit, offset } = parsePagination(searchParams);

  const result = await listKits({
    search: searchParams.get("q")?.trim() || undefined,
    locationId: searchParams.get("location_id") || undefined,
    includeArchived: searchParams.get("include_archived") === "true",
    sortBy: searchParams.get("sort") || undefined,
    sortOrder: (searchParams.get("order") as "asc" | "desc") || undefined,
    limit,
    offset,
  });

  return ok({ ...result, limit, offset });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "kit", "create");

  const body = createSchema.parse(await req.json());
  const kit = await createKit(body, user.id, user.role);

  return ok({ data: kit }, 201);
});
