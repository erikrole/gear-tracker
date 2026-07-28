import { withKiosk } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Heartbeat endpoint — kiosk calls this periodically.
 * requireKiosk() already updates lastSeenAt, so just return ok.
 * GET is preferred (no CSRF gate); POST kept for backward-compat with deployed iOS clients.
 *
 * POST additionally accepts an optional build-identity report so the fleet is
 * legible from the server: which app version, which build, which iPadOS,
 * which model. Without it "did the new build actually land on Video Office?"
 * was unanswerable from the database.
 */

/** Trim, bound, and reject empties so a malformed client can't write junk. */
function field(value: unknown, max = 64): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

const handler = withKiosk(async (req, { kiosk }) => {
  await enforceRateLimit(`kiosk:heartbeat:${kiosk.kioskId}`, { max: 1, windowMs: 60_000 });

  if (req.method === "POST") {
    // Body is optional — older kiosk builds POST nothing at all.
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      const source = body as Record<string, unknown>;
      const report = {
        appVersion: field(source.appVersion),
        appBuild: field(source.appBuild),
        osVersion: field(source.osVersion),
        deviceModel: field(source.deviceModel),
      };

      if (Object.values(report).some((value) => value !== null)) {
        // Only write when something actually changed. A kiosk reports the same
        // build on every heartbeat for weeks; persisting that unconditionally
        // would reintroduce exactly the per-heartbeat write we just removed so
        // the Neon compute endpoint could suspend.
        const current = await db.kioskDevice.findUnique({
          where: { id: kiosk.kioskId },
          select: { appVersion: true, appBuild: true, osVersion: true, deviceModel: true },
        });

        const changed =
          current !== null &&
          (Object.keys(report) as Array<keyof typeof report>).some(
            (key) => report[key] !== null && report[key] !== current[key]
          );

        if (changed) {
          await db.kioskDevice.update({
            where: { id: kiosk.kioskId },
            data: {
              ...(report.appVersion ? { appVersion: report.appVersion } : {}),
              ...(report.appBuild ? { appBuild: report.appBuild } : {}),
              ...(report.osVersion ? { osVersion: report.osVersion } : {}),
              ...(report.deviceModel ? { deviceModel: report.deviceModel } : {}),
              appReportedAt: new Date(),
            },
          });
        }
      }
    }
  }

  return ok({ status: "ok", kioskId: kiosk.kioskId });
});

export const GET = handler;
export const POST = handler;
