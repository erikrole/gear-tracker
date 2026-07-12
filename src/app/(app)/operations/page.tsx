import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import OperationsClient from "./OperationsClient";

export default async function OperationsPage() {
  const user = await requireAuth();

  if (user.role !== Role.ADMIN && user.role !== Role.STAFF) {
    redirect("/");
  }

  return <OperationsClient isAdmin={user.role === Role.ADMIN} />;
}
