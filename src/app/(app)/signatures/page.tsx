import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import SignatureCollectionsPage from "./SignatureCollectionsPage";

export default async function SignaturesPage() {
  const user = await requireAuth();
  requirePermission(user.role, "signature", "view");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/");
  return <SignatureCollectionsPage isAdmin={user.role === "ADMIN"} />;
}
