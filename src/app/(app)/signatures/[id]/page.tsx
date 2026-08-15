import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import SignatureCollectionPage from "./SignatureCollectionPage";

export default async function SignatureCollectionRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  requirePermission(user.role, "signature", "view");
  const { id } = await params;
  return <SignatureCollectionPage collectionId={id} />;
}
