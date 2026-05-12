import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import ForcePasswordChangeForm from "./ForcePasswordChangeForm";

export const metadata: Metadata = {
  title: "Change password · Wisconsin Creative",
  description: "Set a new password before continuing to Wisconsin Creative.",
};

async function getUser() {
  try {
    return await requireAuth();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

export default async function ChangePasswordPage() {
  const user = await getUser();
  if (!user.forcePasswordChange) {
    redirect("/");
  }

  return <ForcePasswordChangeForm email={user.email} />;
}
