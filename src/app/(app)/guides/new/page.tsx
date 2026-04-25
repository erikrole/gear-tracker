import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { NewGuideClient } from "./_components/NewGuideClient";

export default async function NewGuidePage() {
  const user = await requireAuth();

  if (user.role !== Role.ADMIN && user.role !== Role.STAFF) {
    redirect("/guides");
  }

  return <NewGuideClient />;
}
