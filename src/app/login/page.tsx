import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { tokenHash } from "@/lib/auth";
import LoginForm from "./LoginForm";

async function hasActiveSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) return false;

  try {
    const hashed = await tokenHash(token);
    const session = await db.session.findUnique({
      where: { tokenHash: hashed },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return false;
    return session.user.active;
  } catch {
    return false;
  }
}

export default async function LoginPage() {
  if (await hasActiveSession()) {
    redirect("/");
  }
  return <LoginForm />;
}
