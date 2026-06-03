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
const KIOSK_SESSION_MS = 1000 * 60 * 60 * 24 * 7;
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

  const cookieStore = await cookies();

  // Rotate: if the caller already holds a session cookie (re-login while a
  // session is live), revoke that row so the prior token isn't left valid
  // until its natural expiry. No-op when there's no existing cookie.
  const existing = cookieStore.get(env.sessionCookieName)?.value;
  if (existing) {
    const existingHash = await tokenHash(existing);
    await db.session.deleteMany({ where: { tokenHash: existingHash } });
  }

  await db.session.create({
    data: {
      userId,
      tokenHash: hashed,
      expiresAt
    }
  });

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
 * The session expires server-side after seven days and is also bounded by the
 * HTTP-only cookie expiry. Admin deactivation can revoke it earlier.
 */
export async function createKioskSession(kioskId: string): Promise<string> {
  const raw = randomHex(64);
  const hashed = await tokenHash(raw);
  const expiresAt = new Date(Date.now() + KIOSK_SESSION_MS);

  await db.kioskDevice.update({
    where: { id: kioskId },
    data: {
      sessionToken: hashed,
      sessionExpiresAt: expiresAt,
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
    expires: expiresAt,
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

  const now = new Date();
  if (!device.sessionExpiresAt || device.sessionExpiresAt <= now) {
    await db.kioskDevice.update({
      where: { id: device.id },
      data: { sessionToken: null, sessionExpiresAt: null },
    });
    cookieStore.delete(KIOSK_COOKIE);
    throw new HttpError(401, "Kiosk session expired");
  }

  // Keep the browser cookie aligned to the server-side session expiry instead
  // of silently extending custody authority past the DB trust window.
  cookieStore.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: device.sessionExpiresAt,
  });

  // Update last seen (fire and forget — don't block the request)
  Promise.resolve(
    db.kioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } }),
  ).catch(() => {});

  return {
    kioskId: device.id,
    locationId: device.location.id,
    locationName: device.location.name,
  };
}
