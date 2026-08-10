import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60;
const SESSION_PREFIX = "gear-tracker:companion:session:v1:";
const USER_SESSION_PREFIX = "gear-tracker:companion:user-sessions:v1:";
const DEVICE_HASH_KEY = "gear-tracker:companion:devices:v1";
const PROJECTION_KEY = "gear-tracker:companion:projection:v1";

export type CompanionRole = Extract<Role, "ADMIN" | "STAFF">;

type CompanionTokenPayload = {
  version: 1;
  jti: string;
  userId: string;
  role: CompanionRole;
  expiresAt: number;
};

type CompanionSessionRecord = {
  userId: string;
  role: CompanionRole;
  expiresAt: number;
};

type CompanionDeviceRecord = CompanionSessionRecord & {
  jti: string;
  token: string;
};

let redis: Redis | null | undefined;

export function getCompanionRedis(): Redis {
  if (redis !== undefined) {
    if (!redis) throw new HttpError(503, "Companion updates are not configured.");
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  if (!redis) throw new HttpError(503, "Companion updates are not configured.");
  return redis;
}

function signature(value: string): Buffer {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest();
}

function encode(payload: CompanionTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}

function decode(token: string): CompanionTokenPayload {
  const [body, suppliedSignature, extra] = token.split(".");
  if (!body || !suppliedSignature || extra) throw new HttpError(401, "Invalid companion credential.");

  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = signature(body);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new HttpError(401, "Invalid companion credential.");
  }

  let payload: Partial<CompanionTokenPayload>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(401, "Invalid companion credential.");
  }

  if (
    payload.version !== 1 ||
    typeof payload.jti !== "string" ||
    typeof payload.userId !== "string" ||
    (payload.role !== "ADMIN" && payload.role !== "STAFF") ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new HttpError(401, "Invalid companion credential.");
  }
  if (payload.expiresAt <= Date.now()) throw new HttpError(401, "Companion credential expired.");
  return payload as CompanionTokenPayload;
}

function bearerToken(req: Request): string {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "Companion credential required.");
  return authorization.slice("Bearer ".length).trim();
}

export async function issueCompanionSession(user: {
  id: string;
  role: Role;
}): Promise<string> {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "The companion is available to staff accounts only.");
  }

  const payload: CompanionTokenPayload = {
    version: 1,
    jti: crypto.randomUUID(),
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const record: CompanionSessionRecord = {
    userId: payload.userId,
    role: payload.role,
    expiresAt: payload.expiresAt,
  };
  const client = getCompanionRedis();
  const userSessionsKey = `${USER_SESSION_PREFIX}${payload.userId}`;
  await Promise.all([
    client.set(`${SESSION_PREFIX}${payload.jti}`, record, { ex: SESSION_TTL_SECONDS }),
    client.sadd(userSessionsKey, payload.jti),
    client.expire(userSessionsKey, SESSION_TTL_SECONDS),
  ]);
  return encode(payload);
}

export async function requireCompanion(req: Request): Promise<CompanionTokenPayload> {
  const payload = decode(bearerToken(req));
  const record = await getCompanionRedis().get<CompanionSessionRecord>(`${SESSION_PREFIX}${payload.jti}`);
  if (
    !record ||
    record.userId !== payload.userId ||
    record.role !== payload.role ||
    record.expiresAt !== payload.expiresAt
  ) {
    throw new HttpError(401, "Companion credential expired.");
  }
  return payload;
}

export async function revokeCompanionSession(req: Request): Promise<void> {
  const payload = await requireCompanion(req);
  const client = getCompanionRedis();
  const devices = await listCompanionDevices();
  const ownedTokens = devices.filter((device) => device.jti === payload.jti).map((device) => device.token);
  await Promise.all([
    client.del(`${SESSION_PREFIX}${payload.jti}`),
    client.srem(`${USER_SESSION_PREFIX}${payload.userId}`, payload.jti),
    ...(ownedTokens.length > 0 ? [client.hdel(DEVICE_HASH_KEY, ...ownedTokens)] : []),
  ]);
}

export async function revokeCompanionUser(userId: string): Promise<void> {
  const client = getCompanionRedis();
  const userSessionsKey = `${USER_SESSION_PREFIX}${userId}`;
  const [sessionIds, devices] = await Promise.all([
    client.smembers<string[]>(userSessionsKey),
    listCompanionDevices(),
  ]);
  const ownedTokens = devices.filter((device) => device.userId === userId).map((device) => device.token);
  await Promise.all([
    client.del(userSessionsKey),
    ...sessionIds.map((id) => client.del(`${SESSION_PREFIX}${id}`)),
    ...(ownedTokens.length > 0 ? [client.hdel(DEVICE_HASH_KEY, ...ownedTokens)] : []),
  ]);
}

export async function registerCompanionDevice(
  session: CompanionTokenPayload,
  token: string,
): Promise<void> {
  const record: CompanionDeviceRecord = {
    jti: session.jti,
    userId: session.userId,
    role: session.role,
    expiresAt: session.expiresAt,
    token,
  };
  await getCompanionRedis().hset(DEVICE_HASH_KEY, { [token]: JSON.stringify(record) });
}

export async function unregisterCompanionDevice(token: string): Promise<void> {
  await getCompanionRedis().hdel(DEVICE_HASH_KEY, token);
}

export async function listCompanionDevices(): Promise<CompanionDeviceRecord[]> {
  const raw = await getCompanionRedis().hgetall<Record<string, string | CompanionDeviceRecord>>(DEVICE_HASH_KEY);
  if (!raw) return [];
  const now = Date.now();
  const devices: CompanionDeviceRecord[] = [];
  for (const value of Object.values(raw)) {
    try {
      const record = typeof value === "string" ? JSON.parse(value) as CompanionDeviceRecord : value;
      if (record.expiresAt > now && typeof record.token === "string") devices.push(record);
    } catch {
      // Ignore malformed external-cache rows. APNs registration can repair them.
    }
  }
  return devices;
}

export async function revokeCompanionDeviceTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await getCompanionRedis().hdel(DEVICE_HASH_KEY, ...tokens);
}

export async function writeCompanionProjection<T extends { generatedAt: string }>(
  projection: T,
): Promise<boolean> {
  const script = `
    local current = redis.call("GET", KEYS[1])
    if current then
      local ok, decoded = pcall(cjson.decode, current)
      if ok and decoded["generatedAt"] and decoded["generatedAt"] > ARGV[2] then
        return 0
      end
    end
    redis.call("SET", KEYS[1], ARGV[1])
    return 1
  `;
  const installed = await getCompanionRedis().eval<[string, string], number>(
    script,
    [PROJECTION_KEY],
    [JSON.stringify(projection), projection.generatedAt],
  );
  return installed === 1;
}

export async function readCompanionProjection<T>(): Promise<T | null> {
  return getCompanionRedis().get<T>(PROJECTION_KEY);
}

export function resetCompanionRedisForTests(): void {
  redis = undefined;
}
