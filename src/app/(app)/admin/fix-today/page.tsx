import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import FixTodayClient from "./FixTodayClient";

export default async function AdminFixTodayPage() {
  const user = await requireAuth();

  if (user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <FixTodayClient />;
}
