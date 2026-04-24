import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { listAllCodes } from "@/lib/services/licenses";

function csvField(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "license", "manage");
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Admin access required.");
  }

  const codes = await listAllCodes();

  const header = [
    "code",
    "label",
    "account_email",
    "status",
    "slot_1_holder",
    "slot_2_holder",
    "expires_at",
    "created_at",
  ].join(",");

  const rows = codes.map((c) => {
    const holders = c.claims.map((claim) => claim.user?.name ?? claim.occupantLabel ?? "Unknown");
    return [
      csvField(c.code),
      csvField(c.label),
      csvField(c.accountEmail),
      csvField(c.status),
      csvField(holders[0]),
      csvField(holders[1]),
      csvField(c.expiresAt?.toISOString()),
      csvField(c.createdAt.toISOString()),
    ].join(",");
  });

  const body = [header, ...rows].join("\n");
  const filename = `licenses-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
