import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import AccountabilityClient from "./AccountabilityClient";

export default async function AccountabilityPage() {
  const user = await requireAuth();
  try {
    requirePermission(user.role, "accountability", "view");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) redirect("/");
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Accountability"
        description="Late-return patterns for admin review. Rank is based on incidents, not personal judgment."
        className="mb-5"
      />
      <AccountabilityClient />
    </>
  );
}
