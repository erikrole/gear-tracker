import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { randomHex } from "@/lib/crypto";

export { randomHex };

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  forcePasswordChange?: boolean;
};

const SESSION_12H_MS = 1000 * 60 * 60 * 12;
const SESSION_30D_MS = 1000 * 60 * 60 * 24 * 30;
// Kiosk sessions never expire server-side; the cookie is rolled forward on every
// authenticated kiosk request to stay under browser cookie-lifetime caps (~400d).
const KIOSK_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 395;
export const LAST_ACTIVE_REFRESH_MS = 1000 * 60 * 5;

export async function tokenHash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  const buf = new Uint8Array(signature);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(hash: string, password: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, rememberMe = false) {
  const raw = randomHex(32);
  const hashed = await tokenHash(raw);
  const expiresAt = new Date(Date.now() + (rememberMe ? SESSION_30D_MS : SESSION_12H_MS));

  await db.session.create({
    data: {
      userId,
      tokenHash: hashed,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(env.sessionCookieName, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export function shouldRefreshLastActive(lastActiveAt: Date | null | undefined, now = new Date()): boolean {
  return !lastActiveAt || now.getTime() - lastActiveAt.getTime() >= LAST_ACTIVE_REFRESH_MS;
}

async function refreshUserLastActive(userId: string, lastActiveAt: Date | null | undefined, now = new Date()) {
  if (!shouldRefreshLastActive(lastActiveAt, now)) return;

  const staleBefore = new Date(now.getTime() - LAST_ACTIVE_REFRESH_MS);

  try {
    await db.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: staleBefore } },
        ],
      },
      data: { lastActiveAt: now },
    });
  } catch (error) {
    console.error("Failed to update user last active timestamp", error);
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;

  if (token) {
    const hashed = await tokenHash(token);
    await db.session.deleteMany({ where: { tokenHash: hashed } });
  }

  cookieStore.delete(env.sessionCookieName);
}

export async function requireAuth(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;

  if (!token) {
    throw new HttpError(401, "Authentication required");
  }

  const hashed = await tokenHash(token);
  const session = await db.session.findUnique({
    where: { tokenHash: hashed },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    throw new HttpError(401, "Session expired");
  }

  if (!session.user.active) {
    throw new HttpError(401, "Account deactivated");
  }

  await refreshUserLastActive(session.user.id, session.user.lastActiveAt);

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl ?? null,
    forcePasswordChange: session.user.forcePasswordChange,
  };
}

// ── Kiosk Device Auth ────────────────────────────────────

const KIOSK_COOKIE = "kiosk_session";

export type KioskContext = {
  kioskId: string;
  locationId: string;
  locationName: string;
};

/**
 * Create a kiosk session. Called after activation code is validated.
 * The session has no server-side expiry — it stays valid until an admin
 * deactivates the device. The HTTP-only cookie is rolled forward on each request.
 */
export async function createKioskSession(kioskId: string): Promise<string> {
  const raw = randomHex(64);
  const hashed = await tokenHash(raw);

  await db.kioskDevice.update({
    where: { id: kioskId },
    data: {
      sessionToken: hashed,
      sessionExpiresAt: null,
      activatedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(KIOSK_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(Date.now() + KIOSK_COOKIE_MAX_AGE_MS),
  });

  return raw;
}

/**
 * Validate kiosk session cookie.
 * Returns kiosk context (kioskId, locationId, locationName).
 */
export async function requireKiosk(): Promise<KioskContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(KIOSK_COOKIE)?.value;

  if (!token) {
    throw new HttpError(401, "Kiosk session required");
  }

  const hashed = await tokenHash(token);
  const device = await db.kioskDevice.findUnique({
    where: { sessionToken: hashed },
    include: { location: { select: { id: true, name: true } } },
  });

  if (!device) {
    throw new HttpError(401, "Invalid kiosk session");
  }

  if (!device.active) {
    throw new HttpError(401, "Kiosk device deactivated");
  }

  // Roll the cookie forward so a bound kiosk never expires on its own. The
  // session ends only when an admin deactivates the device (clearing sessionToken).
  // Re-issuing on every request keeps the cookie under browser lifetime caps.
  cookieStore.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(Date.now() + KIOSK_COOKIE_MAX_AGE_MS),
  });

  // Update last seen (fire and forget — don't block the request)
  db.kioskDevice
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return {
    kioskId: device.id,
    locationId: device.location.id,
    locationName: device.location.name,
  };
}
