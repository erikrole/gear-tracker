import crypto from "crypto";
import http2 from "http2";

const APNS_PROD_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";

// Primary host follows the server environment, but device tokens are minted
// per-build: Xcode development builds carry sandbox tokens even against the
// production server. A sandbox token sent to the production host answers
// BadDeviceToken, so tokens rejected by the primary host are retried on the
// other host before being treated as dead (see dispatch below).
const APNS_PRIMARY_HOST = process.env.NODE_ENV === "production" ? APNS_PROD_HOST : APNS_SANDBOX_HOST;
const APNS_FALLBACK_HOST = APNS_PRIMARY_HOST === APNS_PROD_HOST ? APNS_SANDBOX_HOST : APNS_PROD_HOST;

function makeJWT(): string {
  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  // APNS_P8_KEY is base64-encoded PEM (the entire .p8 file content)
  const p8Key = Buffer.from(process.env.APNS_P8_KEY!, "base64").toString("utf-8");

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  const signature = sign.sign({ key: p8Key, dsaEncoding: "ieee-p1363" }, "base64url");

  return `${signingInput}.${signature}`;
}

// Apple rejects provider tokens refreshed more often than every 20 minutes
// (TooManyProviderTokenUpdates); tokens stay valid for an hour. Cache at
// module scope so warm serverless instances reuse one token across a
// notification fan-out instead of minting a JWT per send.
const JWT_TTL_MS = 50 * 60_000;
let cachedJwt: { token: string; mintedAt: number } | null = null;

function getJwt(): string {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.mintedAt < JWT_TTL_MS) {
    return cachedJwt.token;
  }
  const token = makeJWT();
  cachedJwt = { token, mintedAt: now };
  return token;
}

/**
 * Drop the cached provider token. Called when APNs answers
 * ExpiredProviderToken/InvalidProviderToken — a warm lambda can resume with a
 * token whose wall-clock validity ran out even though the TTL check passed.
 */
function invalidateJwt(): void {
  cachedJwt = null;
}

/** Per-request timeout — a stalled APNs stream must not hold the function open. */
const APNS_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Connect to APNs with a session error handler attached. Without one, a
 * transient DNS/connection failure emits an unhandled "error" event, which
 * is fatal in Node — it would kill the serverless function mid-request.
 */
function connectApns(host: string): http2.ClientHttp2Session {
  const client = http2.connect(host);
  client.on("error", (err) => {
    console.error("[APNS] session error:", err.message);
  });
  return client;
}

type TokenOutcome =
  | "ok"
  // BadDeviceToken / Unregistered — token invalid for the host it was sent to
  | "badToken"
  // ExpiredProviderToken / InvalidProviderToken — our JWT, not the device
  | "authError"
  | "error";

interface SendOpts {
  topic: string;
  pushType: "alert" | "liveactivity";
  /**
   * `apns-collapse-id`. APNs replaces any undelivered *and* already-delivered
   * notification carrying the same id on that device, so an escalation ladder
   * (due 1h → due now → overdue 1h → overdue 3h) reads as one updating alert
   * instead of four stacked banners. Apple caps this at 64 bytes.
   */
  collapseId?: string;
}

/** APNs rejects `apns-collapse-id` values over 64 bytes outright. */
const MAX_COLLAPSE_ID_BYTES = 64;

function collapseHeader(collapseId: string | undefined): Record<string, string> {
  if (!collapseId) return {};
  if (Buffer.byteLength(collapseId, "utf8") > MAX_COLLAPSE_ID_BYTES) {
    console.error(`[APNS] collapse id too long, sending uncollapsed: ${collapseId.slice(0, 16)}…`);
    return {};
  }
  return { "apns-collapse-id": collapseId };
}

function sendOne(
  client: http2.ClientHttp2Session,
  jwt: string,
  token: string,
  notification: object,
  opts: SendOpts
): Promise<TokenOutcome> {
  return new Promise((resolve) => {
    let req: http2.ClientHttp2Stream;
    try {
      req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": opts.topic,
        "apns-push-type": opts.pushType,
        "content-type": "application/json",
        ...collapseHeader(opts.collapseId),
      });
    } catch (err) {
      // Session already destroyed (e.g. connection error) — requests on a
      // dead session throw synchronously.
      console.error("[APNS] request open failed:", err instanceof Error ? err.message : err);
      return resolve("error");
    }

    req.setTimeout(APNS_REQUEST_TIMEOUT_MS, () => {
      console.error(`[APNS] ${token.slice(-8)}: request timed out`);
      req.close(http2.constants.NGHTTP2_CANCEL);
      resolve("error");
    });

    let status = 0;
    let body = "";

    req.on("response", (headers) => {
      status = headers[":status"] as number;
    });
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (status === 200) return resolve("ok");
      try {
        const { reason } = JSON.parse(body) as { reason?: string };
        if (reason === "BadDeviceToken" || reason === "Unregistered") {
          resolve("badToken");
        } else if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") {
          console.error(`[APNS] provider token rejected (${reason})`);
          resolve("authError");
        } else {
          console.error(`[APNS] ${token.slice(-8)}: ${status} ${reason}`);
          resolve("error");
        }
      } catch {
        console.error(`[APNS] ${token.slice(-8)}: ${status} (unparseable body)`);
        resolve("error");
      }
    });
    req.on("error", (err) => {
      console.error("[APNS] request error:", err.message);
      resolve("error");
    });

    req.end(JSON.stringify(notification));
  });
}

/** Sends one notification to a batch of tokens over a single session to `host`. */
async function sendBatch(
  host: string,
  jwt: string,
  tokens: string[],
  notification: object,
  opts: SendOpts
): Promise<Map<string, TokenOutcome>> {
  const client = connectApns(host);
  const outcomes = new Map<string, TokenOutcome>();
  try {
    await Promise.all(
      tokens.map(async (token) => {
        outcomes.set(token, await sendOne(client, jwt, token, notification, opts));
      })
    );
  } finally {
    client.destroy();
  }
  return outcomes;
}

function isConfigured(): boolean {
  return !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID &&
    process.env.APNS_P8_KEY
  );
}

export interface DispatchResult {
  /** Tokens rejected by BOTH APNs environments — safe to mark revoked. */
  revoked: string[];
  /** Count of tokens APNs accepted (either environment). */
  ok: number;
}

/**
 * Delivery core shared by alert and Live Activity sends.
 *
 * 1. Send to the primary host (production in prod, sandbox in dev).
 * 2. Auth failures (expired/invalid provider token) re-mint the JWT and retry
 *    those tokens once.
 * 3. Tokens the primary host rejects as bad are retried on the other APNs
 *    environment — development builds hold sandbox tokens even against the
 *    production server. Only tokens both environments reject are revoked.
 */
async function dispatch(
  tokens: string[],
  notification: object,
  opts: SendOpts
): Promise<DispatchResult> {
  if (!isConfigured() || tokens.length === 0) return { revoked: [], ok: 0 };

  const outcomes = await sendBatch(APNS_PRIMARY_HOST, getJwt(), tokens, notification, opts);

  const authFailed = tokens.filter((t) => outcomes.get(t) === "authError");
  if (authFailed.length > 0) {
    invalidateJwt();
    const retried = await sendBatch(APNS_PRIMARY_HOST, getJwt(), authFailed, notification, opts);
    for (const [token, outcome] of retried) outcomes.set(token, outcome);
  }

  const revoked: string[] = [];
  const wrongEnv = tokens.filter((t) => outcomes.get(t) === "badToken");
  if (wrongEnv.length > 0) {
    const fallback = await sendBatch(APNS_FALLBACK_HOST, getJwt(), wrongEnv, notification, opts);
    for (const [token, outcome] of fallback) {
      if (outcome === "badToken") {
        revoked.push(token);
      }
      outcomes.set(token, outcome);
    }
  }

  let ok = 0;
  for (const outcome of outcomes.values()) {
    if (outcome === "ok") ok += 1;
  }
  if (ok < tokens.length) {
    console.warn(
      `[APNS] dispatch: ${ok}/${tokens.length} delivered` +
        (wrongEnv.length > 0 ? `, ${wrongEnv.length} retried on fallback env` : "") +
        (revoked.length > 0 ? `, ${revoked.length} revoked` : "")
    );
  }

  return { revoked, ok };
}

/**
 * `time-sensitive` alerts break through Focus and Do Not Disturb. Reserved for
 * notifications that lose their value if they wait (overdue gear), never for
 * informational ones — the entitlement is revocable if Apple decides we cried
 * wolf, and users mute an app that abuses it.
 */
export type InterruptionLevel = "passive" | "active" | "time-sensitive";

export interface AlertOptions {
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  /** App icon badge. Pass the user's total unread count, not a delta. */
  badge?: number;
  /** `thread-id`: groups related alerts into one stack in Notification Center. */
  threadId?: string;
  /** See `SendOpts.collapseId`. */
  collapseId?: string;
  interruptionLevel?: InterruptionLevel;
}

export async function sendPush(
  deviceTokens: string[],
  opts: AlertOptions
): Promise<DispatchResult> {
  const notification = {
    aps: {
      alert: { title: opts.title, body: opts.body },
      sound: "default",
      // Omit rather than send 0 when unknown: an explicit 0 clears the badge,
      // which would wipe a legitimate count every time a caller didn't supply one.
      ...(typeof opts.badge === "number" ? { badge: Math.max(0, opts.badge) } : {}),
      ...(opts.threadId ? { "thread-id": opts.threadId } : {}),
      ...(opts.interruptionLevel ? { "interruption-level": opts.interruptionLevel } : {}),
    },
    ...(opts.payload ?? {}),
  };

  return dispatch(deviceTokens, notification, {
    topic: process.env.APNS_BUNDLE_ID!,
    pushType: "alert",
    collapseId: opts.collapseId,
  });
}

const liveActivityOpts = (): SendOpts => ({
  topic: `${process.env.APNS_BUNDLE_ID!}.push-type.liveactivity`,
  pushType: "liveactivity",
});

export async function endCheckoutReturnLiveActivityTokens(
  tokens: string[]
): Promise<{ revoked: string[] }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const notification = {
    aps: {
      timestamp: nowSeconds,
      event: "end",
      "dismissal-date": nowSeconds + 120,
      "content-state": {
        endsAt: new Date().toISOString(),
        now: new Date().toISOString(),
        nextNeedAt: null,
        allowsExtend: false,
        urgency: "returned",
      },
    },
  };

  return dispatch(tokens, notification, liveActivityOpts());
}

export async function startCheckoutReturnLiveActivityTokens(
  tokens: string[],
  attrs: {
    bookingId: string;
    bookingTitle: string;
    requesterName: string;
    requesterInitials: string;
    requesterAvatarUrl?: string | null;
    returnTimeText: string;
  },
  state: {
    endsAt: Date;
    nextNeedAt?: Date | null;
    allowsExtend: boolean;
    urgency: "normal" | "warning" | "critical" | "overdue";
  }
): Promise<{ revoked: string[]; ok: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const notification = {
    aps: {
      timestamp: nowSeconds,
      event: "start",
      "attributes-type": "CheckoutReturnActivityAttributes",
      attributes: {
        bookingId: attrs.bookingId,
        bookingTitle: attrs.bookingTitle,
        requesterName: attrs.requesterName,
        requesterInitials: attrs.requesterInitials,
        requesterAvatarUrl: attrs.requesterAvatarUrl ?? null,
        returnTimeText: attrs.returnTimeText,
      },
      "content-state": {
        endsAt: state.endsAt.toISOString(),
        now: new Date().toISOString(),
        nextNeedAt: state.nextNeedAt?.toISOString() ?? null,
        allowsExtend: state.allowsExtend,
        urgency: state.urgency,
      },
      "stale-date": staleDateFor(state.endsAt),
      "input-push-token": 1,
      alert: {
        title: attrs.bookingTitle,
        body: attrs.returnTimeText,
      },
    },
  };

  return dispatch(tokens, notification, liveActivityOpts());
}

/**
 * How long after the return time an activity's content is still worth trusting.
 * Past this the system dims it as stale rather than showing a countdown nobody
 * has refreshed.
 */
const LIVE_ACTIVITY_STALE_AFTER_MS = 6 * 60 * 60_000;

function staleDateFor(endsAt: Date): number {
  return Math.floor((endsAt.getTime() + LIVE_ACTIVITY_STALE_AFTER_MS) / 1000);
}

export async function updateCheckoutReturnLiveActivityTokens(
  tokens: string[],
  state: {
    endsAt: Date;
    nextNeedAt?: Date | null;
    allowsExtend: boolean;
    urgency: "normal" | "warning" | "critical" | "overdue";
  },
  opts?: { alert?: { title: string; body: string } }
): Promise<{ revoked: string[] }> {
  const notification = {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: "update",
      // Re-sent on every update: the stale date is part of the pushed content,
      // so omitting it here cleared the one `start` established and left the
      // activity able to show an unrefreshed countdown indefinitely.
      "stale-date": staleDateFor(state.endsAt),
      "content-state": {
        endsAt: state.endsAt.toISOString(),
        now: new Date().toISOString(),
        nextNeedAt: state.nextNeedAt?.toISOString() ?? null,
        allowsExtend: state.allowsExtend,
        urgency: state.urgency,
      },
      ...(opts?.alert ? { alert: { title: opts.alert.title, body: opts.alert.body } } : {}),
    },
  };

  return dispatch(tokens, notification, liveActivityOpts());
}
