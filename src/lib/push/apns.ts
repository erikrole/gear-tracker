import crypto from "crypto";
import http2 from "http2";

const APNS_HOST =
  process.env.NODE_ENV === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

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

/** Per-request timeout — a stalled APNs stream must not hold the function open. */
const APNS_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Connect to APNs with a session error handler attached. Without one, a
 * transient DNS/connection failure emits an unhandled "error" event, which
 * is fatal in Node — it would kill the serverless function mid-request.
 */
function connectApns(): http2.ClientHttp2Session {
  const client = http2.connect(APNS_HOST);
  client.on("error", (err) => {
    console.error("[APNS] session error:", err.message);
  });
  return client;
}

type SendResult = "ok" | "revoked" | "error";

function sendOne(
  client: http2.ClientHttp2Session,
  jwt: string,
  token: string,
  notification: object,
  opts: { topic: string; pushType: "alert" | "liveactivity" }
): Promise<SendResult> {
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
          resolve("revoked");
        } else {
          console.error(`[APNS] ${token.slice(-8)}: ${reason}`);
          resolve("error");
        }
      } catch {
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

function isConfigured(): boolean {
  return !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID &&
    process.env.APNS_P8_KEY
  );
}

export async function sendPush(
  deviceTokens: string[],
  opts: { title: string; body: string; payload?: Record<string, unknown> }
): Promise<{ revoked: string[] }> {
  if (!isConfigured() || deviceTokens.length === 0) return { revoked: [] };

  const notification = {
    aps: {
      alert: { title: opts.title, body: opts.body },
      sound: "default",
    },
    ...(opts.payload ?? {}),
  };

  const jwt = getJwt();
  const client = connectApns();

  const revoked: string[] = [];

  try {
    await Promise.all(
      deviceTokens.map(async (token) => {
        const result = await sendOne(client, jwt, token, notification, {
          topic: process.env.APNS_BUNDLE_ID!,
          pushType: "alert",
        });
        if (result === "revoked") revoked.push(token);
      })
    );
  } catch (err) {
    console.error("[APNS] sendPush error:", err);
  } finally {
    client.destroy();
  }

  return { revoked };
}

export async function endCheckoutReturnLiveActivityTokens(
  tokens: string[]
): Promise<{ revoked: string[] }> {
  if (!isConfigured() || tokens.length === 0) return { revoked: [] };

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

  const jwt = getJwt();
  const client = connectApns();
  const revoked: string[] = [];

  try {
    await Promise.all(
      tokens.map(async (token) => {
        const result = await sendOne(client, jwt, token, notification, {
          topic: `${process.env.APNS_BUNDLE_ID!}.push-type.liveactivity`,
          pushType: "liveactivity",
        });
        if (result === "revoked") revoked.push(token);
      })
    );
  } catch (err) {
    console.error("[APNS] endCheckoutReturnLiveActivityTokens error:", err);
  } finally {
    client.destroy();
  }

  return { revoked };
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
  if (!isConfigured() || tokens.length === 0) return { revoked: [], ok: 0 };

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
      "stale-date": Math.floor((state.endsAt.getTime() + 6 * 60 * 60_000) / 1000),
      "input-push-token": 1,
      alert: {
        title: attrs.bookingTitle,
        body: attrs.returnTimeText,
      },
    },
  };

  const jwt = getJwt();
  const client = connectApns();
  const revoked: string[] = [];
  let ok = 0;

  try {
    await Promise.all(
      tokens.map(async (token) => {
        const result = await sendOne(client, jwt, token, notification, {
          topic: `${process.env.APNS_BUNDLE_ID!}.push-type.liveactivity`,
          pushType: "liveactivity",
        });
        if (result === "revoked") revoked.push(token);
        if (result === "ok") ok += 1;
      })
    );
  } catch (err) {
    console.error("[APNS] startCheckoutReturnLiveActivityTokens error:", err);
  } finally {
    client.destroy();
  }

  return { revoked, ok };
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
  if (!isConfigured() || tokens.length === 0) return { revoked: [] };

  const notification = {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: "update",
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

  const jwt = getJwt();
  const client = connectApns();
  const revoked: string[] = [];

  try {
    await Promise.all(
      tokens.map(async (token) => {
        const result = await sendOne(client, jwt, token, notification, {
          topic: `${process.env.APNS_BUNDLE_ID!}.push-type.liveactivity`,
          pushType: "liveactivity",
        });
        if (result === "revoked") revoked.push(token);
      })
    );
  } catch (err) {
    console.error("[APNS] updateCheckoutReturnLiveActivityTokens error:", err);
  } finally {
    client.destroy();
  }

  return { revoked };
}
