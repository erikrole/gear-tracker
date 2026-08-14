import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { canViewUsageAnalytics } from "@/lib/usage-analytics";

export default async function UsageReportLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!canViewUsageAnalytics(user)) redirect("/reports");
  return children;
}
