import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  dbModuleLoaded: false,
  values: new Map<string, unknown>(),
  hashes: new Map<string, Map<string, unknown>>(),
}));

vi.mock("@/lib/db", () => {
  state.dbModuleLoaded = true;
  return { db: {} };
});

vi.mock("@upstash/redis", () => ({
  Redis: class {
    async get<T>(key: string): Promise<T | null> {
      return (state.values.get(key) as T | undefined) ?? null;
    }

    async eval(_script: string, keys: string[], args: string[]): Promise<number> {
      if (keys.length === 3 && args.length === 4) {
        const [epochKey = "", sessionKey = ""] = keys;
        const [expectedEpoch = "0", rawRecord = "{}"] = args;
        if (Number(state.values.get(epochKey) ?? 0) !== Number(expectedEpoch)) return 0;
        state.values.set(sessionKey, JSON.parse(rawRecord));
        return 1;
      }

      const [sessionKey = "", epochKey = "", devicesKey = ""] = keys;
      const [expectedEpoch = "0", token = "", rawRecord = "{}"] = args;
      if (!state.values.has(sessionKey)) return 0;
      if (Number(state.values.get(epochKey) ?? 0) !== Number(expectedEpoch)) return 0;
      const devices = state.hashes.get(devicesKey) ?? new Map<string, unknown>();
      devices.set(token, rawRecord);
      state.hashes.set(devicesKey, devices);
      return 1;
    }

    async del(...keys: string[]): Promise<number> {
      return keys.reduce((count, key) => count + (state.values.delete(key) ? 1 : 0), 0);
    }

    async srem(): Promise<number> {
      return 0;
    }

    async hgetall<T>(key: string): Promise<T | null> {
      const hash = state.hashes.get(key);
      return hash ? Object.fromEntries(hash) as T : null;
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
      const hash = state.hashes.get(key);
      if (!hash) return 0;
      return fields.reduce((count, field) => count + (hash.delete(field) ? 1 : 0), 0);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }

    async limit() {
      return { success: true, remaining: 99, reset: Date.now() + 60_000 };
    }
  },
}));

import { DELETE, POST } from "@/app/api/companion/devices/route";
import { POST as RENEW } from "@/app/api/companion/session/route";
import { GET } from "@/app/api/companion/projection/route";
import { resetCompanionRedisForTests } from "@/lib/companion-store";

const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalSessionSecret = process.env.SESSION_SECRET;
const sessionSecret = "external-route-test-session-secret-at-least-32-characters";

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function seedCredential(): string {
  const expiresAt = Date.now() + 60_000;
  const payload = {
    version: 1,
    jti: "session-1",
    userId: "user-1",
    role: "STAFF",
    expiresAt,
    epoch: 0,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(body).digest("base64url");
  state.values.set("gear-tracker:companion:session:v1:session-1", {
    userId: "user-1",
    role: "STAFF",
    expiresAt,
    epoch: 0,
  });
  state.values.set("gear-tracker:companion:projection:v1", {
    version: 1,
    revision: 1,
    generatedAt: "2026-08-12T12:00:00.000Z",
    stats: { checkedOut: 0, overdue: 0, reserved: 0, dueToday: 0 },
    pendingPickupTotal: 0,
    openBookings: [],
    bookingActivity: [],
    kioskDevices: [{ id: "kiosk-1" }],
  });
  return `${body}.${signature}`;
}

function request(path: string, credential: string, init: RequestInit = {}): Request {
  return new Request(`https://wisconsincreative.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${credential}`,
      ...(init.headers ?? {}),
    },
  });
}

describe("automatic companion route dependency boundary", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = sessionSecret;
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    state.dbModuleLoaded = false;
    state.values.clear();
    state.hashes.clear();
    resetCompanionRedisForTests();
  });

  afterEach(() => {
    restoreEnvironment("UPSTASH_REDIS_REST_URL", originalRedisUrl);
    restoreEnvironment("UPSTASH_REDIS_REST_TOKEN", originalRedisToken);
    restoreEnvironment("SESSION_SECRET", originalSessionSecret);
    resetCompanionRedisForTests();
  });

  it("executes projection read, device registration, and sign-out without loading Neon", async () => {
    const credential = seedCredential();

    const projectionResponse = await GET(
      request("/api/companion/projection", credential),
      { params: Promise.resolve({}) },
    );
    const registrationResponse = await POST(
      request("/api/companion/devices", credential, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "aabbccdd" }),
      }),
      { params: Promise.resolve({}) },
    );
    const renewalResponse = await RENEW(
      request("/api/companion/session", credential, { method: "POST" }),
      { params: Promise.resolve({}) },
    );
    const signOutResponse = await DELETE(
      request("/api/companion/devices", credential, { method: "DELETE" }),
      { params: Promise.resolve({}) },
    );

    expect(projectionResponse.status).toBe(200);
    await expect(projectionResponse.json()).resolves.toMatchObject({
      data: { kioskAccess: "restricted", kioskDevices: [] },
    });
    expect(registrationResponse.status).toBe(200);
    expect(renewalResponse.status).toBe(200);
    await expect(renewalResponse.json()).resolves.toMatchObject({
      companionToken: expect.any(String),
    });
    expect(signOutResponse.status).toBe(200);
    expect(state.hashes.get("gear-tracker:companion:devices:v1")?.size ?? 0).toBe(0);
    expect(state.dbModuleLoaded).toBe(false);
  });
});
