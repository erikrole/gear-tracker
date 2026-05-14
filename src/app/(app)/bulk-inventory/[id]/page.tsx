"use client";

import { useParams } from "next/navigation";
import { BulkSkuDetailExperience } from "./BulkSkuDetailExperience";

export default function BulkSkuDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <BulkSkuDetailExperience id={id} />;
}
