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

type SendResult = "ok" | "revoked" | "error";

function sendOne(
  client: http2.ClientHttp2Session,
  jwt: string,
  token: string,
  notification: object
): Promise<SendResult> {
  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APNS_BUNDLE_ID!,
      "apns-push-type": "alert",
      "content-type": "application/json",
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

  const jwt = makeJWT();
  const client = http2.connect(APNS_HOST);

  const revoked: string[] = [];

  try {
    await Promise.all(
      deviceTokens.map(async (token) => {
        const result = await sendOne(client, jwt, token, notification);
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
