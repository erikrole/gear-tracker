import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { csvField } from "@/lib/csv";

const EXPORT_LIMIT = 5000;

export const GET = withAuth(async (req, { user }) => {
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin access required");
  await enforceRateLimit(`bookings:export:${user.id}`, { max: 5, windowMs: 60_000 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const kindParam = searchParams.get("kind"); // CHECKOUT | RESERVATION | (all)

  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;

  const where = {
    ...(kindParam === "CHECKOUT" || kindParam === "RESERVATION" ? { kind: kindParam as "CHECKOUT" | "RESERVATION" } : {}),
    ...(from || to ? {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    } : {}),
  };

  const [bookings, totalCount] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        requester: { select: { name: true, email: true } },
        location: { select: { name: true } },
        serializedItems: { include: { asset: { select: { assetTag: true, name: true } } } },
        bulkItems: { include: { bulkSku: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
    }),
    db.booking.count({ where }),
  ]);

  const truncated = totalCount > EXPORT_LIMIT;

  const headers = [
    "Ref #", "Kind", "Title", "Requester", "Requester Email",
    "Location", "Status", "Starts At", "Ends At",
    "Serialized Items", "Bulk Items", "Notes", "Created At", "Completed At",
  ];

  const rows = bookings.map((b) => {
    const serialized = b.serializedItems.map((s) => `${s.asset.assetTag} – ${s.asset.name || ""}`.trim()).join("; ");
    const bulk = b.bulkItems.map((bi) => `${bi.bulkSku.name} ×${bi.plannedQuantity}`).join("; ");
    return [
      csvField(b.refNumber || ""),
      csvField(b.kind),
      csvField(b.title),
      csvField(b.requester.name),
      csvField(b.requester.email),
      csvField(b.location.name),
      csvField(b.status),
      csvField(b.startsAt.toISOString()),
      csvField(b.endsAt.toISOString()),
      csvField(serialized),
      csvField(bulk),
      csvField(b.notes || ""),
      csvField(b.createdAt.toISOString()),
      csvField(b.completedAt?.toISOString() || ""),
    ];
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-export-${date}.csv"`,
      ...(truncated ? { "X-Total-Count": String(totalCount), "X-Truncated": "true" } : {}),
    },
  });
});
