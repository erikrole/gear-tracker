import { after } from "next/server";

const scheduledRequests = new WeakSet<Request>();

export function shouldPublishCompanionProjection(req: Request, response: Response): boolean {
  if (!response.ok || req.method === "GET" || req.method === "HEAD") return false;
  const path = new URL(req.url).pathname;
  return (
    path.startsWith("/api/bookings") ||
    (path === "/api/reservations" || path.startsWith("/api/reservations/")) ||
    path.startsWith("/api/checkouts") ||
    path.startsWith("/api/kiosk/checkout") ||
    path.startsWith("/api/kiosk/pickup") ||
    path.startsWith("/api/kiosk/checkin") ||
    path === "/api/kiosk/activate" ||
    path.startsWith("/api/kiosk-devices") ||
    (req.method === "PATCH" && path === "/api/profile") ||
    (req.method === "PUT" && path === "/api/me/profile") ||
    (req.method === "PATCH" && /^\/api\/users\/[^/]+$/.test(path)) ||
    (req.method === "PATCH" && /^\/api\/locations\/[^/]+$/.test(path)) ||
    (/^\/api\/users\/[^/]+\/avatar$/.test(path))
  );
}

async function publishCompanionProjection(): Promise<void> {
  const { refreshCompanionProjection } = await import("@/lib/services/companion-projection");
  await refreshCompanionProjection({ notify: true });
}

function scheduleCompanionProjectionRefresh(req: Request): void {
  if (process.env.NODE_ENV === "test" || scheduledRequests.has(req)) return;
  scheduledRequests.add(req);
  const task = () => publishCompanionProjection().catch((error) => {
    console.error("[Companion] projection refresh failed", error);
  });
  try {
    after(task);
  } catch {
    void task();
  }
}

export function deferCompanionProjectionRefresh(req: Request, response: Response): void {
  if (!shouldPublishCompanionProjection(req, response)) return;
  scheduleCompanionProjectionRefresh(req);
}

/**
 * Schedule from the canonical commit boundary when later response work can
 * still fail. The normal API wrapper calls the same scheduler on success; the
 * request-scoped guard keeps that path to one projection build.
 */
export function deferCompanionProjectionRefreshForCommittedMutation(req: Request): void {
  if (!shouldPublishCompanionProjection(req, new Response(null, { status: 204 }))) return;
  scheduleCompanionProjectionRefresh(req);
}
