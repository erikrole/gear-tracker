import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/rbac";
import { workingScheduleCommandSchema } from "@/lib/schedule-working-copy";
import {
  discardWorkingSchedule,
  getWorkingScheduleEditor,
  mutateWorkingSchedule,
} from "@/lib/services/schedule-working-copy";

const mutateSchema = z.object({
  expectedVersion: z.number().int().min(0),
  command: workingScheduleCommandSchema,
});

const discardSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
});

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  return ok({ data: await getWorkingScheduleEditor(params.id) });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`shift:working-copy:${user.id}`, { max: 120, windowMs: 60_000 });
  const body = mutateSchema.parse(await req.json());
  const data = await mutateWorkingSchedule(params.id, body.expectedVersion, body.command, user);
  return ok({ data });
});

export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "manage");
  await enforceRateLimit(`shift:working-copy:${user.id}`, { max: 30, windowMs: 60_000 });
  const query = discardSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok({ data: await discardWorkingSchedule(params.id, query.expectedVersion, user) });
});
