import crypto from "node:crypto";
import argon2 from "argon2";
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

function tokenHash(token: string) {
  return crypto.createHmac("sha256", env.sessionSecret).update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function createSession(userId: string) {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = tokenHash(raw);
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
    await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }

  cookieStore.delete(env.sessionCookieName);
}

export async function requireAuth(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;

  if (!token) {
    throw new HttpError(401, "Authentication required");
  }

  const hashed = tokenHash(token);
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
