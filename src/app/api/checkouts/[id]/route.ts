import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";

/**
 * Deprecated: GET /api/checkouts/[id]
 * The unified /api/bookings/[id] endpoint serves both checkouts and reservations.
 * This redirect preserves backward compatibility for any external consumers.
 */
export const GET = withAuth<{ id: string }>(async (req, { params }) => {
  const url = new URL(req.url);
  url.pathname = `/api/bookings/${params.id}`;
  return NextResponse.redirect(url, 308);
});
