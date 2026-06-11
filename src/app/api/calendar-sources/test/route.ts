import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertPublicHost } from "@/lib/security/ssrf";
import {
  CALENDAR_FETCH_TIMEOUT_MS,
  CALENDAR_MAX_RESPONSE_BYTES,
  fetchCalendarText,
} from "@/lib/services/bounded-calendar-fetch";

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
});

/**
 * POST /api/calendar-sources/test
 * Probe an ICS URL without persisting anything — used by the Add form on
 * /settings/calendar-sources to give immediate feedback before saving.
 *
 * Returns shape { ok, status, contentType, byteSize, eventCount, sampleSummaries[], error? }.
 *
 * SSRF note: this hits arbitrary admin-supplied URLs. Acceptable for an
 * admin-only endpoint behind auth + rate limit, but worth tightening later
 * (block private IP ranges) if STAFF ever gets access.
 */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "calendar_source", "create");
  await enforceRateLimit(`calendar-sources:test:${user.id}`, { max: 10, windowMs: 60_000 });

  const body = bodySchema.parse(await req.json());

  // webcal:// is just an unsecured HTTPS in calendar feeds.
  let url = body.url.trim().replace(/^webcal:\/\//i, "https://");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, "That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, "URL must use http or https.");
  }
  try {
    await assertPublicHost(parsed.hostname);
  } catch {
    throw new HttpError(400, "URL host is private or non-routable.");
  }
  url = parsed.toString();

  try {
    const response = await fetchCalendarText(url, {
      timeoutMs: CALENDAR_FETCH_TIMEOUT_MS,
      maxBytes: CALENDAR_MAX_RESPONSE_BYTES,
      userAgentSuffix: "probe",
    });

    const status = response.status;
    const contentType = response.contentType;

    if (!response.ok) {
      return ok({
        data: {
          ok: false,
          status,
          contentType,
          byteSize: 0,
          eventCount: 0,
          sampleSummaries: [],
          error: `HTTP ${status} ${response.statusText || ""}`.trim(),
        },
      });
    }

    const text = response.text;

    // Lightweight VEVENT scan — avoids reusing the full parser for a probe.
    const eventBlocks = text.split(/BEGIN:VEVENT/i).slice(1);
    const eventCount = eventBlocks.length;
    const sampleSummaries: string[] = [];
    for (const block of eventBlocks.slice(0, 5)) {
      const m = block.match(/\nSUMMARY[^:]*:([^\r\n]{1,200})/i);
      if (m) sampleSummaries.push(m[1]!.trim()); // capture group 1 always present when match succeeds
    }

    const looksLikeIcs = /^BEGIN:VCALENDAR/im.test(text);
    if (!looksLikeIcs) {
      return ok({
        data: {
          ok: false,
          status,
          contentType,
          byteSize: response.byteSize,
          eventCount: 0,
          sampleSummaries: [],
          error: "Reachable, but the response doesn't look like an ICS feed (no BEGIN:VCALENDAR).",
        },
      });
    }

    return ok({
      data: {
        ok: true,
        status,
        contentType,
        byteSize: response.byteSize,
        eventCount,
        sampleSummaries,
      },
    });
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : "Fetch failed.";
    return ok({
      data: {
        ok: false,
        status: 0,
        contentType: null,
        byteSize: 0,
        eventCount: 0,
        sampleSummaries: [],
        error: message,
      },
    });
  }
});
