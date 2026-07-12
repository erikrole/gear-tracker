import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { HttpError } from "@/lib/http";
import { ReportsNav } from "./ReportsNav";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  try {
    requirePermission(user.role, "report", "view");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) redirect("/");
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Read-only analytics for inventory, checkouts, scan health, missing units, badges, and audit history."
        className="mb-4"
      />

      <ReportsNav role={user.role} />

      {children}
    </>
  );
}
