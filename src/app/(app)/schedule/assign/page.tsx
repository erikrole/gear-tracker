import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { AssignPageClient } from "./_components/AssignPageClient";

export default async function AssignPage() {
  const user = await requireAuth();

  if (user.role !== "STAFF" && user.role !== "ADMIN") {
    redirect("/schedule");
  }

  return <AssignPageClient />;
}
