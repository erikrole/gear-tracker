import { withAuth } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

function manualReleaseRetired(): never {
  throw new HttpError(410, "Schedules release automatically 10 minutes after the latest change.");
}

export const GET = withAuth<{ id: string }>(async (_req, { user }) => {
  requirePermission(user.role, "shift", "manage");
  return manualReleaseRetired();
});

export const POST = withAuth<{ id: string }>(async (_req, { user }) => {
  requirePermission(user.role, "shift", "manage");
  return manualReleaseRetired();
});
