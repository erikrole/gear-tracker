import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { EditGuideClient } from "./_components/EditGuideClient";

type Props = { params: Promise<{ slug: string }> };

export default async function EditGuidePage({ params }: Props) {
  const { slug } = await params;
  const user = await requireAuth();

  if (user.role !== Role.ADMIN && user.role !== Role.STAFF) {
    redirect(`/guides/${slug}`);
  }

  return <EditGuideClient slug={slug} userRole={user.role} />;
}
