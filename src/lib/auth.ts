import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const sessionDurationMs = 1000 * 60 * 60 * 12;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tokenHash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  return toHex(signature);
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(hash: string, password: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const raw = randomHex(32);
  const hashed = await tokenHash(raw);
  const expiresAt = new Date(Date.now() + sessionDurationMs);

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

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role
  };
}
